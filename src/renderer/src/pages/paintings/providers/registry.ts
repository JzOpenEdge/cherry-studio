import { uuid } from '@renderer/utils'

import { canonicalGenerate, type CanonicalGenerateOptions } from '../model/canonicalGenerate'
import type { PaintingData } from '../model/types/paintingData'
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
