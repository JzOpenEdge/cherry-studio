import { uuid } from '@renderer/utils'

import { canonicalGenerate } from '../model/canonicalGenerate'
import type { OvmsPaintingData, SiliconPaintingData, ZhipuPaintingData } from '../model/types/paintingData'
import { loadPaintingModelOptions } from '../model/utils/paintingModelOptions'
import { resolveCogviewSize } from '../model/validators/cogviewSize'
import { createSingleModeProvider, type PaintingProviderDefinition } from './shared/provider'

/**
 * Core painting providers — small, registry-backed adapters with no UI
 * components and no vendor-specific transport routing tables. Each entry
 * declares only its `canonicalGenerate` options (AI-SDK fieldMap aliases,
 * vendor-specific resolvers, snake-case providerBag mirror); the rest of
 * the provider (`id`, `models` loader, `createPaintingData`, etc.) is
 * pure mechanical wiring.
 *
 * Empty-state handling (no model selected → prompt disabled), auth gating
 * (`checkProviderEnabled` knows OVMS runs without an API key), and form
 * empty-state are cross-cutting concerns — they no longer live here.
 */

const baseCreatePaintingData = <T extends { providerId: string }>(
  providerId: T['providerId'],
  modelOptions: { value: string }[] | undefined
) =>
  ({
    id: uuid(),
    providerId,
    mode: 'generate' as const,
    files: [],
    prompt: '',
    model: modelOptions?.[0]?.value ?? ''
  }) as unknown as T

export const siliconProvider: PaintingProviderDefinition = createSingleModeProvider<SiliconPaintingData>({
  id: 'silicon',
  dbMode: 'generate',
  models: { type: 'async', loader: () => loadPaintingModelOptions('silicon') },
  createPaintingData: ({ modelOptions }) => baseCreatePaintingData<SiliconPaintingData>('silicon', modelOptions),
  fields: [],
  // Silicon persists `imageSize` / `steps` instead of the canonical
  // `size` / `numInferenceSteps`. Both aliases live here until the
  // `PaintingData` union shrink lets the renderer use canonical names.
  registryKeyMap: { size: 'imageSize', numInferenceSteps: 'steps' },
  onModelChange: ({ modelId }) => ({ model: modelId }),
  generate: (input) => canonicalGenerate(input, { fieldMap: { batchSize: 'numImages', numInferenceSteps: 'steps' } })
})

export const zhipuProvider: PaintingProviderDefinition = createSingleModeProvider<ZhipuPaintingData>({
  id: 'zhipu',
  dbMode: 'generate',
  models: { type: 'async', loader: () => loadPaintingModelOptions('zhipu') },
  createPaintingData: ({ modelOptions }) => baseCreatePaintingData<ZhipuPaintingData>('zhipu', modelOptions),
  fields: [],
  registryKeyMap: { size: 'imageSize' },
  onModelChange: ({ modelId }) => ({ model: modelId }),
  // CogView's custom-size rules (range / divisible-by-16 / pixel-budget /
  // required-when-mode=custom) live in `resolveCogviewSize` — until the
  // registry schema can express those constraints declaratively.
  generate: (input) =>
    canonicalGenerate(input, { fieldMap: { batchSize: 'numImages' }, resolvers: { imageSize: resolveCogviewSize } })
})

export const ovmsProvider: PaintingProviderDefinition = createSingleModeProvider<OvmsPaintingData>({
  id: 'ovms',
  dbMode: 'generate',
  models: { type: 'async', loader: () => loadPaintingModelOptions('ovms') },
  createPaintingData: ({ modelOptions }) => baseCreatePaintingData<OvmsPaintingData>('ovms', modelOptions),
  fields: [],
  onModelChange: ({ modelId }) => ({ model: modelId }),
  // Form fields come from the registry's provider-level `paintingDefaults`
  // (packages/provider-registry/data/providers.json) — OVMS users register
  // arbitrary local checkpoints, so per-model entries can't be enumerated.
  // OVMS uses snake-case wire params (`num_inference_steps` / `rng_seed`);
  // the providerBag mirrors those onto the canonical names the transport
  // adapter reads. `checkProviderEnabled` knows OVMS is auth-less.
  generate: (input) =>
    canonicalGenerate(input, {
      fieldMap: { imageSize: 'size' },
      providerBag: (painting) => ({
        model: painting.model,
        size: painting.size,
        numInferenceSteps: painting.num_inference_steps,
        rngSeed: painting.rng_seed
      })
    })
})
