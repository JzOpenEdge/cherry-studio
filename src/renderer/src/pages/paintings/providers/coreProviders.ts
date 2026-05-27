import { uuid } from '@renderer/utils'

import { canonicalGenerate } from '../model/canonicalGenerate'
import type { OvmsPaintingData, SiliconPaintingData, ZhipuPaintingData } from '../model/types/paintingData'
import { loadPaintingModelOptions } from '../model/utils/paintingModelOptions'
import { resolveCogviewSize } from '../model/validators/cogviewSize'
import { createSingleModeProvider, type PaintingProviderDefinition } from './shared/provider'

/**
 * Core painting providers — small, registry-backed adapters that don't ship
 * their own UI components or vendor-specific transport tables. Each one
 * declares only the bits that can't be derived from the provider-registry:
 * AI-SDK fieldMap aliases, a `noAuth` flag, a vendor-specific image-size
 * resolver, or a snake-case `providerBag` mirror. Everything else (model
 * dropdown, form fields, defaults) flows through the shared registry path.
 *
 * Providers in this file: silicon, zhipu, ovms. Adding a new vendor here is
 * a ~10-line entry rather than a 5-file directory.
 *
 * Providers NOT in this file still ship their own directories because they
 * carry vendor UI components (newapi `NewApiSetting`, dmxapi `DmxapiSetting`,
 * tokenflux `TokenFluxCenterContent` / `TokenFluxSetting`) or vendor-specific
 * transport routing tables (aihubmix `MODEL_PARAM_RULES`, ppio `PPIO_MODELS`).
 */

const generateSiliconRandomSeed = () => Math.floor(Math.random() * 1000000).toString()

const SENTINEL_OVMS_MODEL_VALUE = 'none'

export const siliconProvider: PaintingProviderDefinition = createSingleModeProvider<SiliconPaintingData>({
  id: 'silicon',
  dbMode: 'generate',
  models: {
    type: 'async',
    loader: () => loadPaintingModelOptions('silicon')
  },
  // Random `seed` is kept as an active feature (the user can read the value
  // off the form and reuse it for reproducible reruns); every other knob is
  // left unset so the registry's per-model defaults govern.
  createPaintingData: ({ modelOptions }) => ({
    id: uuid(),
    providerId: 'silicon',
    mode: 'generate',
    files: [],
    prompt: '',
    seed: generateSiliconRandomSeed(),
    model: modelOptions?.[0]?.value ?? ''
  }),
  fields: [],
  // Silicon persists `imageSize` and `steps`; canonical AI-SDK names are
  // `imageSize` (identical) and `numInferenceSteps`. The registryKeyMap
  // shapes the form's canonical→stored aliasing; the fieldMap below
  // shapes the executor's AI-SDK→stored aliasing.
  registryKeyMap: { size: 'imageSize', numInferenceSteps: 'steps' },
  onModelChange: ({ modelId }) => ({ model: modelId }),
  generate: (input) => canonicalGenerate(input, { fieldMap: { batchSize: 'numImages', numInferenceSteps: 'steps' } })
})

export const zhipuProvider: PaintingProviderDefinition = createSingleModeProvider<ZhipuPaintingData>({
  id: 'zhipu',
  dbMode: 'generate',
  models: {
    type: 'async',
    loader: () => loadPaintingModelOptions('zhipu')
  },
  createPaintingData: ({ modelOptions }) => ({
    id: uuid(),
    providerId: 'zhipu',
    mode: 'generate',
    files: [],
    prompt: '',
    model: modelOptions?.[0]?.value ?? ''
  }),
  fields: [],
  // PaintingData persists size as `imageSize`. CogView's custom-size rules
  // (range / divisible-by-16 / pixel-budget / required-when-mode=custom)
  // live in `resolveCogviewSize`.
  registryKeyMap: { size: 'imageSize' },
  onModelChange: ({ modelId }) => ({ model: modelId }),
  generate: (input) =>
    canonicalGenerate(input, {
      fieldMap: { batchSize: 'numImages' },
      resolvers: { imageSize: resolveCogviewSize }
    })
})

export const ovmsProvider: PaintingProviderDefinition = createSingleModeProvider<OvmsPaintingData>({
  id: 'ovms',
  dbMode: 'generate',
  models: {
    type: 'async',
    loader: () => loadPaintingModelOptions('ovms')
  },
  createPaintingData: ({ modelOptions }) => ({
    id: uuid(),
    providerId: 'ovms',
    mode: 'generate',
    files: [],
    prompt: '',
    model: modelOptions?.[0]?.value || SENTINEL_OVMS_MODEL_VALUE
  }),
  // Form fields come from the registry's provider-level `paintingDefaults`
  // (packages/provider-registry/data/providers.json) — OVMS users register
  // arbitrary local checkpoints, so per-model entries can't be enumerated,
  // but the API contract (size / num_inference_steps / rng_seed) is fixed
  // provider-wide.
  fields: [],
  onModelChange: ({ modelId }) => ({ model: modelId }),
  prompt: {
    disabled: ({ painting, isLoading }) => isLoading || !painting.model || painting.model === SENTINEL_OVMS_MODEL_VALUE
  },
  // OVMS is auth-less (local OpenVINO Model Server) — `noAuth: true` skips
  // `checkProviderEnabled`. The bespoke snake-case extras (`num_inference_steps`,
  // `rng_seed`) go through `providerBag` since they don't fit the canonical
  // AI-SDK aiSdkParams shape.
  generate: (input) =>
    canonicalGenerate(input, {
      noAuth: true,
      fieldMap: { imageSize: 'size' },
      providerBag: (painting) => ({
        model: painting.model,
        size: painting.size,
        numInferenceSteps: painting.num_inference_steps,
        rngSeed: painting.rng_seed
      })
    })
})
