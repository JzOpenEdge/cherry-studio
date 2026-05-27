import { uuid } from '@renderer/utils'

import type { AihubmixPaintingData } from '../../model/types/paintingData'

export function createDefaultAihubmixPainting(tab?: string): AihubmixPaintingData {
  return {
    id: uuid(),
    providerId: 'aihubmix',
    mode: tab ?? 'generate',
    // Tab-specific seed model — generate-mode picks the default text-to-image
    // model, the image-mode tabs (remix / upscale) target Ideogram V_3 since
    // it's the most capable of those flows. Per-field knobs (size, batch,
    // aspectRatio, quality, etc.) stay unset so the server applies the
    // model's own defaults.
    model: tab === 'generate' || tab === undefined ? 'gemini-3-pro-image-preview' : 'V_3',
    prompt: '',
    files: []
  }
}
