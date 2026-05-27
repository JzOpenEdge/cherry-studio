import { uuid } from '@renderer/utils'
import type { PaintingMode } from '@shared/data/types/painting'

import type { PpioPaintingData } from '../../model/types/paintingData'
import { getModelsByMode, type PpioMode } from './models'

export function createDefaultPpioPainting(mode?: string): PpioPaintingData {
  const currentMode = (mode || 'ppio_draw') as PpioMode
  const models = getModelsByMode(currentMode)
  return {
    id: uuid(),
    providerId: 'ppio',
    mode: (currentMode === 'ppio_edit' ? 'edit' : 'draw') as PaintingMode,
    model: models[0]?.id ?? 'jimeng-txt2img-v3.1',
    prompt: '',
    files: []
  }
}
