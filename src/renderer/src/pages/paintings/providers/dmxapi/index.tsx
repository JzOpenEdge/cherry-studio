import { uuid } from '@renderer/utils'
import type { Model } from '@shared/data/types/model'

import type { DmxapiPaintingData as DmxapiPainting } from '../../model/types/paintingData'
import type { ModelOption } from '../../model/types/paintingModel'
import { loadPaintingModelOptions } from '../../model/utils/paintingModelOptions'
import type { PaintingProvider } from '../types'
import { DEFAULT_PAINTING } from './config'
import { buildDmxapiConfigFields } from './fields'
import { generateWithDmxapiUnified } from './generateUnified'

const generateRandomSeed = () => Math.floor(Math.random() * 1000000).toString()

/**
 * Pull dmxapi-specific UI metadata off the registry's `imageGeneration` block
 * so the painting page can render its dropdown labels, default size, custom-size
 * gate, and pass `extend_params` through providerBag — without a side-channel
 * catalog fetch.
 */
function modelOptionFromRegistry(opt: ModelOption<Model>): ModelOption<Model> {
  const ig = opt.raw?.imageGeneration
  const sizes = ig?.sizes ?? []
  return {
    ...opt,
    meta: {
      ...opt.meta,
      price: '',
      image_sizes: sizes.map((v: string) => ({ label: v, value: v })),
      is_custom_size: ig?.customSize !== undefined,
      min_image_size: ig?.customSize?.min,
      max_image_size: ig?.customSize?.max,
      extend_params: ig?.vendorParams ?? {}
    }
  }
}

export const dmxapiProvider = {
  id: 'dmxapi',
  mode: {
    // edit / merge tabs were retired with the prompt-box attachment work —
    // mode is now derived from `painting.inputFiles.length` at generate
    // time (0 → generate, 1 → edit, ≥2 → merge). Any dmxapi image-gen
    // model is reachable through this single entry.
    tabs: [{ value: 'generate', labelKey: 'paintings.mode.generate' }],
    defaultTab: 'generate',
    tabToDbMode: () => 'generate',
    getModels: () => ({
      type: 'async' as const,
      loader: async () => {
        const all = (await loadPaintingModelOptions('dmxapi')) as ModelOption<Model>[]
        return all.map(modelOptionFromRegistry)
      }
    }),
    createPaintingData: ({ modelOptions }) => {
      const first = modelOptions?.[0]
      const firstMeta = first?.meta ?? {}
      return {
        ...DEFAULT_PAINTING,
        id: uuid(),
        mode: 'generate',
        // Seed is client-generated so the user can read and reuse it for
        // reproducible reruns. Should migrate to the registry's
        // `supports.seed: true` per-model declaration so the form auto-
        // renders the field without dmxapi needing a vendor extras block.
        seed: generateRandomSeed(),
        model: first?.value || '',
        priceModel: String(firstMeta.price || ''),
        extend_params: (firstMeta.extend_params as Record<string, unknown> | undefined) || {}
      }
    }
  },
  // size + customSize derive from each model's `imageGeneration` block in
  // the registry; `seed` is dmxapi's lone vendor extra — TODO: declare
  // `supports.seed: true` on dmxapi models in the registry so this row
  // becomes registry-derived too and `buildDmxapiConfigFields` disappears.
  registryKeyMap: { size: 'image_size' },
  fields: {
    byTab: { generate: buildDmxapiConfigFields() },
    onModelChange: ({ modelId, modelOptions }) => {
      const model = modelOptions.find((item) => item.value === modelId)
      if (model) {
        const modelMeta = model.meta ?? {}
        // priceModel / extend_params are vendor plumbing carried from the
        // model's metadata; image_size stays unset so the form's
        // registry-driven initialValue chip is what the user sees until
        // they pick (server applies its own default when omitted).
        return {
          model: modelId,
          priceModel: String(modelMeta.price || ''),
          extend_params: (modelMeta.extend_params as Record<string, unknown> | undefined) || {}
        } as Partial<DmxapiPainting>
      }
      return { model: modelId } as Partial<DmxapiPainting>
    }
  },
  generate: (input) => generateWithDmxapiUnified(input)
} satisfies PaintingProvider<DmxapiPainting>
