# Architecture Overview

> **Note**: The v2 branch is undergoing a major architecture refactoring. This document will be continuously updated as the refactoring progresses. Some sections may describe the target architecture rather than the current state.

This document provides a high-level overview of Cherry Studio's architecture, covering the Electron process model, key subsystems, data flow, and monorepo structure.

## Process Model

Cherry Studio is an Electron application with three process types:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                             │
│  (Node.js — src/main/)                                         │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ Lifecycle    │ │ Data Layer   │ │ Services                │ │
│  │ Container    │ │              │ │                         │ │
│  │ (IoC, phased│ │ DbService    │ │ MainWindowService           │ │
│  │  bootstrap) │ │ CacheService │ │ MCPService              │ │
│  │              │ │ Preference   │ │ KnowledgeService        │ │
│  │              │ │ DataApi      │ │ AgentBootstrapService   │ │
│  │              │ │ BootConfig   │ │ SearchService           │ │
│  │              │ │              │ │ ... (27 total)          │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ API Server   │ │ Knowledge    │ │ MCP Servers             │ │
│  │ (Express)    │ │ (RAG)        │ │ (Model Context Protocol)│ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ IPC (contextBridge)
                  ┌─────────┴─────────┐
                  │   Preload Scripts  │
                  │   (src/preload/)   │
                  └─────────┬─────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                     Renderer Process                            │
│  (Chromium — src/renderer/)                                     │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ React 19     │ │ State        │ │ Data Hooks              │ │
│  │ UI Layer     │ │              │ │                         │ │
│  │ (Shadcn UI + │ │ Redux Store  │ │ useQuery / useMutation  │ │
│  │  Tailwind)   │ │ (messages,   │ │ usePreference           │ │
│  │              │ │  assistants) │ │ useCache / usePersist   │ │
│  │ TipTap Editor│ │              │ │                         │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ AI Core      │ │ Pages        │ │ Windows                 │ │
│  │ (Provider    │ │ (Chat, Agent │ │ (Main, Mini,            │ │
│  │  middleware)  │ │  Settings)   │ │  Selection Toolbar)     │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

A typical user interaction follows this path:

```
User Input (React UI)
  │
  ├── Chat Message ──→ AI Core (Provider Middleware) ──→ LLM API
  │                         │
  │                         ├── Stream chunks ──→ Redux Store ──→ UI Update
  │                         └── Message blocks ──→ DataApi ──→ SQLite (persist)
  │
  ├── Setting Change ──→ usePreference ──→ IPC ──→ PreferenceService ──→ SQLite
  │                                                     │
  │                                                     └── Broadcast to all windows
  │
  └── Business Data ──→ useQuery/useMutation ──→ IPC ──→ DataApi Handler
       (topics, files)                                       │
                                                             ├── Service Layer
                                                             ├── Repository Layer
                                                             └── SQLite (Drizzle ORM)
```

## Four Data Systems

Cherry Studio uses four data systems, each optimized for different data characteristics:

| System | Storage | Timing | Use Case |
|--------|---------|--------|----------|
| **BootConfig** | JSON file | Pre-lifecycle (sync) | Chromium flags, hardware accel |
| **Cache** | Memory (per-process) / Shared (Main-relayed) / Persist (renderer localStorage) | Runtime | Temp data, UI state, cross-window coordination |
| **Preference** | SQLite | Post-lifecycle | User settings (theme, language) |
| **DataApi** | SQLite (Drizzle) | Post-lifecycle | Business data (topics, messages) |

See [Data System Reference](./data/README.md) for detailed architecture, decision flowcharts, and usage patterns.

## Service Lifecycle

Services that own long-lived resources use the lifecycle system (IoC container with phased bootstrap):

```
Application Bootstrap
  │
  ├── Phase 1: Infrastructure
  │     DbService → CacheService → PreferenceService → DataApiService
  │
  ├── Phase 2: Core Services
  │     MainWindowService, ProxyManager, ThemeService, ShortcutService, ...
  │
  ├── Phase 3: Feature Services
  │     MCPService, KnowledgeService, SearchService, ...
  │
  └── Phase 4: Late Services
        AppUpdaterService, AgentBootstrapService, ApiServerService, ...
```

Services register in `src/main/core/application/serviceRegistry.ts` and are accessed via `application.get('ServiceName')`. See [Lifecycle Reference](./lifecycle/README.md) for full documentation.

## AI Core Architecture

The AI processing pipeline uses a three-layer middleware pattern:

```
User Message
  │
  ├── Provider Registry ──→ Select AI provider (OpenAI, Anthropic, etc.)
  │
  ├── Middleware Chain ──→ Pre-processing (context, knowledge, tools)
  │
  ├── Vercel AI SDK v5 ──→ Streaming LLM call
  │
  └── Response Pipeline ──→ Message blocks (text, code, image, tool-call)
```

See [AI Reference](./ai/README.md) for the complete data flow.

## Monorepo Structure

```
cherry-studio
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── ai/                  #   Main-owned AI runtime, streams, tools, MCP, agent sessions
│   │   ├── core/                #   Lifecycle, Application, paths
│   │   ├── data/                #   Data layer (DB, Cache, Preference, DataApi)
│   │   ├── services/            #   Main process services outside AI/data/core
│   │   ├── knowledge/           #   RAG / knowledge base
│   │   ├── ai/mcp/servers/      #   Built-in MCP servers
│   │   ├── apiServer/           #   Local REST API (Express)
│   │   └── integration/         #   External integrations
│   │
│   ├── renderer/                # Renderer process (React)
│   │   └── src/
│   │       ├── pages/           #   Route pages (Chat, Settings, Agent, ...)
│   │       ├── components/      #   Shared UI components
│   │       ├── store/           #   Legacy store modules being removed in v2
│   │       ├── data/            #   Data hooks and services
│   │       ├── transport/       #   Renderer IPC transports
│   │       └── windows/         #   Multi-window entry points
│   │
│   └── preload/                 # Preload scripts (IPC bridge)
│
├── packages/
│   ├── shared/                  #   Shared types, schemas, constants
│   ├── ui/                      #   @cherrystudio/ui (Shadcn + Tailwind)
│   ├── aiCore/                  #   @cherrystudio/ai-core
│   ├── ai-sdk-provider/         #   Custom AI SDK providers
│   ├── provider-registry/       #   Provider registry
│   ├── mcp-trace/               #   OpenTelemetry tracing
│   └── extension-table-plus/    #   TipTap table extension
│
├── docs/                        # Documentation (this directory)
│   ├── guides/                  #   How-to guides
│   └── references/              #   Technical references
│
└── scripts/                     # Build, lint, i18n, and CI scripts
```

## Key Subsystems

| Subsystem | Location | Documentation |
|-----------|----------|---------------|
| Service Lifecycle | `src/main/core/lifecycle/` | [Lifecycle Reference](./lifecycle/README.md) |
| Data Layer | `src/main/data/` | [Data Reference](./data/README.md) |
| AI Core | `src/main/ai/` | [AI Reference](./ai/README.md) |
| MCP (Tool Use) | `src/main/ai/mcp/` | — |
| Knowledge (RAG) | `src/main/knowledge/` | [KnowledgeService](./knowledge/knowledge-service.md) |
| Message System | `src/renderer/src/store/` | [Message System](./messaging/message-system.md) |
| CherryClaw (Agent) | `src/main/ai/agents/cherryclaw/` | [CherryClaw Overview](./cherryclaw/overview.md) |
| API Server | `src/main/apiServer/` | [App Upgrade Config](./app-upgrade.md) |

## Window Architecture

Cherry Studio runs multiple windows, each with its own renderer entry point:

| Window | Purpose |
|--------|---------|
| Main Window | Primary chat and settings interface |
| Quick Assistant | Quick-access floating panel |
| Selection Toolbar | Text selection actions overlay |

Windows are managed by `MainWindowService` and communicate through IPC and shared state (CacheService, PreferenceService).
