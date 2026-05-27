import type { PpioPaintingData as PaintingData } from '../../model/types/paintingData'
import { loadPaintingModelOptions } from '../../model/utils/paintingModelOptions'
import type { PaintingProvider } from '../types'
import { createDefaultPpioPainting } from './defaults'
import { generateWithPpioUnified } from './generateUnified'
import { PPIO_MODELS } from './models'

// PPIO_MODELS lists each model under one or both modes; unify into a single
// "is this id reachable?" set so the dropdown shows any model with a
// transport route, regardless of which mode hosts it.
const PPIO_MODEL_IDS = new Set(PPIO_MODELS.map((m) => m.id))
const PPIO_GROUP_BY_ID = new Map(PPIO_MODELS.map((m) => [m.id, m.group]))

export const ppioProvider = {
  id: 'ppio',
  mode: {
    // draw / edit tabs were retired with the prompt-box attachment work —
    // `generateWithPpioUnified` derives the PpioMode from the selected
    // model + whether the user attached an image. Any ppio image-gen model
    // (txt2img, img2img, upscale, eraser, …) is reachable from this single
    // entry.
    tabs: [{ value: 'generate', labelKey: 'paintings.mode.generate' }],
    defaultTab: 'generate',
    tabToDbMode: () => 'generate',
    getModels: () => ({
      type: 'async' as const,
      loader: async () => {
        const userEnabled = await loadPaintingModelOptions('ppio')
        return userEnabled
          .filter((opt) => PPIO_MODEL_IDS.has(opt.value))
          .map((opt) => ({ ...opt, group: PPIO_GROUP_BY_ID.get(opt.value) ?? opt.group }))
      }
    }),
    createPaintingData: () => createDefaultPpioPainting()
  },
  // Field list comes from the registry's per-model `imageGeneration` block.
  // Per-model keyMap aliases canonical keys to legacy field names — `seed`
  // → `ppioSeed`, `promptEnhancement` → `usePreLlm`, `imageResolution` →
  // `resolution` — so existing PaintingData shape stays intact.
  fields: {
    byTab: {},
    onModelChange: ({ modelId }) => ({ model: modelId }) as Partial<PaintingData>
  },
  generate: (input) => generateWithPpioUnified(input)
} satisfies PaintingProvider<PaintingData>
