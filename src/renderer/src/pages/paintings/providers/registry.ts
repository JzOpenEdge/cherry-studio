import i18n from '@renderer/i18n'
import { uuid } from '@renderer/utils'

import { canonicalGenerate, type CanonicalGenerateOptions } from '../model/canonicalGenerate'
import type { OpenApiCompatiblePaintingData, PaintingData } from '../model/types/paintingData'
import { loadPaintingModelOptions } from '../model/utils/paintingModelOptions'
import { resolveCogviewSize } from '../model/validators/cogviewSize'
import { aihubmixProvider } from './aihubmix'
import { dmxapiProvider } from './dmxapi'
import { ppioProvider } from './ppio'
import { createSingleModeProvider, type PaintingProviderDefinition } from './shared/provider'
import { tokenFluxProvider } from './tokenflux'

/**
 * Single-mode painting providers whose only vendor-specific bits are AI-SDK
 * aliases, a vendor-specific image-size resolver, or a snake-case
 * providerBag mirror. Each entry's body IS the provider's reason to exist —
 * everything else (id, models loader, createPaintingData, onModelChange) is
 * mechanical wiring that `buildSimpleProvider` synthesises.
 *
 * Adding a no-UI / no-transport-table vendor is one new row here. Vendors
 * that ship UI components or per-model transport routing tables (aihubmix,
 * dmxapi, ppio, tokenflux) keep their own modules and are mounted below.
 */
interface SimpleProviderConfig {
  registryKeyMap?: Record<string, string>
  generateOptions: CanonicalGenerateOptions<any>
}

const SIMPLE_PROVIDERS: Record<string, SimpleProviderConfig> = {
  // SiliconPaintingData stores size/steps under `imageSize`/`steps`; both
  // keymaps bridge to the canonical names until the PaintingData union
  // shrink lets the renderer use canonical fields directly.
  silicon: {
    registryKeyMap: { size: 'imageSize', numInferenceSteps: 'steps' },
    generateOptions: { fieldMap: { batchSize: 'numImages', numInferenceSteps: 'steps' } }
  },
  // CogView's custom-size rules (range / divisible-by-16 / pixel-budget /
  // required-when-mode=custom) live in `resolveCogviewSize` — until the
  // registry schema can express those constraints declaratively.
  zhipu: {
    registryKeyMap: { size: 'imageSize' },
    generateOptions: { fieldMap: { batchSize: 'numImages' }, resolvers: { imageSize: resolveCogviewSize } }
  },
  // OVMS wires snake-case params (`num_inference_steps` / `rng_seed`) onto
  // the canonical names via providerBag. `checkProviderEnabled` already
  // knows OVMS is auth-less; no per-call flag needed here.
  ovms: {
    generateOptions: {
      fieldMap: { imageSize: 'size' },
      providerBag: (p: any) => ({
        model: p.model,
        size: p.size,
        numInferenceSteps: p.num_inference_steps,
        rngSeed: p.rng_seed
      })
    }
  }
}

function buildSimpleProvider(id: string, config: SimpleProviderConfig): PaintingProviderDefinition {
  return createSingleModeProvider<PaintingData>({
    id,
    dbMode: 'generate',
    models: { type: 'async', loader: () => loadPaintingModelOptions(id) },
    createPaintingData: ({ modelOptions }) =>
      ({
        id: uuid(),
        providerId: id,
        mode: 'generate',
        files: [],
        prompt: '',
        model: modelOptions?.[0]?.value ?? ''
      }) as PaintingData,
    fields: [],
    registryKeyMap: config.registryKeyMap,
    onModelChange: ({ modelId }) => ({ model: modelId }),
    generate: (input) => canonicalGenerate(input, config.generateOptions as CanonicalGenerateOptions<PaintingData>)
  })
}

export const providerRegistry: Record<string, PaintingProviderDefinition> = {
  ...Object.fromEntries(Object.entries(SIMPLE_PROVIDERS).map(([id, c]) => [id, buildSimpleProvider(id, c)])),
  aihubmix: aihubmixProvider,
  dmxapi: dmxapiProvider,
  ppio: ppioProvider,
  tokenflux: tokenFluxProvider
}

/**
 * Catch-all factory for OpenAI-compatible providers — every provider that
 * isn't in `providerRegistry` (new-api, cherryin, aionly, any user-added
 * OpenAI-compatible provider) goes through here. Uses the AI SDK's native
 * `/v1/images/generations` ⇄ `/v1/images/edits` switch, driven by
 * `painting.inputFiles` (the prompt-box attachment surface).
 *
 * `imagen-*` models prefer English prompts, so the placeholder swaps to an
 * English hint when one is selected — the lone vendor-specific UI bit
 * that survives the collapse.
 */
export function createOpenApiCompatibleProvider(providerId: string): PaintingProviderDefinition {
  return createSingleModeProvider<OpenApiCompatiblePaintingData>({
    id: providerId,
    dbMode: 'generate',
    models: { type: 'async', loader: () => loadPaintingModelOptions(providerId) },
    createPaintingData: ({ modelOptions }) => ({
      id: uuid(),
      providerId,
      mode: 'generate',
      files: [],
      prompt: '',
      model: modelOptions?.[0]?.value || ''
    }),
    fields: [],
    onModelChange: ({ modelId }) => ({ model: modelId }),
    prompt: {
      placeholder: ({ painting }) => {
        if (painting.model?.startsWith('imagen-')) return i18n.t('paintings.prompt_placeholder_en')
        return i18n.t('paintings.prompt_placeholder_edit')
      }
    },
    generate: (input) =>
      canonicalGenerate(input, {
        fieldMap: { batchSize: 'n' },
        // `painting.size === 'auto'` must omit `imageSize` entirely and let
        // `allowAutoSize: true` tell AiProvider to skip the 1024×1024 default.
        // Registry-driven models (Nano Banana Pro etc.) store the resolution
        // chip's value under `painting.imageSize` via the registry keyMap —
        // fall through to that field when the legacy `size` isn't set.
        resolvers: {
          imageSize: (p) => {
            if (p.size && p.size !== 'auto') return p.size
            const resolution = (p as unknown as Record<string, unknown>).imageSize
            return typeof resolution === 'string' && resolution !== '' ? resolution : undefined
          }
        },
        constants: { allowAutoSize: true },
        // When the user attaches an image through the prompt box, the AI SDK
        // call switches to the "edit" prompt shape (`{ text, images }`) and
        // routes to `/v1/images/edits`.
        forwardInputFilesAsEditImages: true
      } as CanonicalGenerateOptions<OpenApiCompatiblePaintingData>)
  })
}
