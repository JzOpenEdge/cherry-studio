# AiService & IPC — Reviewer Cluster

## Scope

| File | LOC | Role |
|---|---|---|
| `src/main/ai/AiService.ts` | 551 | Lifecycle service; non-stream IPC handler registration; SDK dispatch |
| `src/main/ai/types/requests.ts` | 51 | `AiBaseRequest`, `AiStreamRequest`, `AiTransportOptions`, `ListModelsRequest` |
| `src/main/ai/types/merged.ts` | 76 | `AppProviderSettingsMap` extension type merging |
| `src/main/ai/types/index.ts` | 45 | Re-exports + `AppProviderId` map |
| Tests | `__tests__/AiService.test.ts` (114) | Lifecycle + IPC handler smoke tests |

## Intent

`AiService` is the lifecycle-owned entry for non-stream `Ai_*` channels
and in-process SDK dispatch. It is intentionally thin — it routes calls into the
shared building blocks (`Agent`, `buildAgentParams`, `dispatchStreamRequest`,
`translateService`) and is not where business logic lives. Adding a new
LLM-driven IPC entry should be one IPC line in `registerIpcHandlers()`
plus a method.

## IPC channels owned

| Channel | Mode | Handler |
|---|---|---|
| `Ai_GenerateText` | `ipcHandle` | `generateText(request)` — non-streaming |
| `Ai_CheckModel` | `ipcHandle` | `checkModel(request, timeout?)` — health probe |
| `Ai_EmbedMany` | `ipcHandle` | `embedMany(request)` |
| `Ai_GenerateImage` | `ipcHandle` | image generation with a request-scoped abort controller |
| `Ai_AbortImage` | `ipcOn` | aborts the matching image request by renderer-generated request id |
| `Ai_ListModels` | `ipcHandle` | `listModels(request)` |
| `Ai_Translate_Open` | `ipcHandle` | `translateService.translate(request)` — see [translate-on-main.md](./translate-on-main.md) |
| `Ai_ToolApproval_Respond` | `ipcHandle` | applies decision, dispatches `continue-conversation` when all decided |
| `Ai_Stream_Open` / `Ai_Stream_Attach` / `Ai_Stream_Detach` / `Ai_Stream_Abort` | `AiStreamManager` IPC handlers | stream lifecycle and attach/detach live on the manager, not `AiService` |

## Key changes

### Lifecycle decoration

```ts
@Injectable()
@ServicePhase(Phase.WhenReady)
@DependsOn(['McpRuntimeService', 'McpCatalogService', 'AiStreamManager'])
export class AiService extends BaseService {
  protected async onInit(): Promise<void> {
    registerBuiltinTools()
    this.registerIpcHandlers()
  }

  protected async onStop(): Promise<void> {
    toolApprovalRegistry.clear('ai-service-stop')
  }
}
```

- **`@DependsOn(['McpRuntimeService', 'McpCatalogService', 'AiStreamManager'])`** — explicit
  because some methods read from `AiStreamManager` (e.g. continue
  dispatch after approval). The manager is in the same phase; container
  resolves the order.
- **Tool registry init in `onInit`** — `registerBuiltinTools()` registers
  the built-in tools on the singleton.
- **Clean stop drains approvals** — outstanding `canUseTool` promises
  are rejected so they don't hang across a service restart.

### `Ai_GenerateImage` request registry

The image generation channel uses `ipcHandle` for `Ai_GenerateImage` and
an `Ai_AbortImage` fire-and-forget channel. The renderer supplies a
request id; Main stores one `AbortController` per request id and deletes
the entry in the handler's `finally` block.

This is intentionally local to image generation until the shared
`ipcHandleWithAbort` helper lands.

### `Ai_ToolApproval_Respond`

The handler resolves an `approval-requested` ToolUIPart to
`approval-approved` / `approval-denied`:

1. Loads the anchor message's current parts.
2. Computes new parts via `applyApprovalDecisions(beforeParts, [decision])`.
3. **Writes only when the target part is present on the DB row** —
   guards the overlay-only case where the renderer sees the part before
   it persisted.
4. If any approval on the turn is still pending, returns early.
5. Otherwise either resolves the Claude-Agent `canUseTool` promise (via
   `toolApprovalRegistry`) or dispatches a synthetic
   `continue-conversation` through `dispatchStreamRequest`.

See [Tool Approval](../../../docs/references/ai/tool-approval.md) for
the design rationale.

### `AiRequestOptions` vs `AiTransportOptions`

- `AiTransportOptions` — IPC-serialisable; this is what renderer
  payloads use.
- `AiRequestOptions` — extends with `AbortSignal`; only in-process
  callers can attach (e.g. `AiStreamManager.runExecutionLoop`).

`AsInProcess<T>` widens a request type's `requestOptions` to accept
the in-process shape. Used on `AiService.*` method signatures so the
type system rejects the renderer trying to pass a signal across IPC.

### `runPromptStream`

`AiService.runPromptStream` is the entry point for ad-hoc one-shot
streams (translate, summarisation, model probes). Bypasses
`dispatchStreamRequest`; calls `AiStreamManager.streamPrompt(...)`
directly with a synthetic topicId and the caller's WebContentsListener.
Uses `promptStreamLifecycle` (no status broadcast, no grace period).

### Types

- `types/requests.ts` — `AiBaseRequest`, `AiStreamRequest`,
  `ListModelsRequest`. All transport types are flat (no nested
  optionality), serialisable.
- `types/merged.ts` — `AppProviderSettingsMap` merges core SDK
  `CoreProviderSettingsMap` with Cherry's app-level extensions
  (claude-code, aihubmix, newapi). Provides the `AppProviderId` union
  via `StringKeys<...>`.

## Invariants

- `AiService` owns non-stream AI IPC. `AiStreamManager` owns stream
  open/attach/detach/abort.
- IPC handlers narrow renderer input to `AiTransportOptions` —
  `signal` injection happens only on in-process callers.
- `Ai_GenerateImage` is the only request-id abort registry in this
  service; new abort-capable handlers should use a shared helper once it
  exists.

## Validation

- `__tests__/AiService.test.ts` (114) — lifecycle smoke + IPC
  registration + ToolApproval handler edge cases.

## Follow-ups (out of scope)

- The `Ai_ToolApproval_Respond` handler's "all decided?" check assumes
  the approval-requested parts live on the anchor message. If
  approvals ever land on non-anchor parts we'll revisit.
- See memory [Cherry AI tools — open work items](../../../) for
  follow-up work on tool-loop refinement.
