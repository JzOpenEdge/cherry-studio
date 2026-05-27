import { uuid } from '@renderer/utils'

import type { PpioPaintingData } from '../../model/types/paintingData'
import { PPIO_MODELS } from './models'

export function createDefaultPpioPainting(): PpioPaintingData {
  return {
    id: uuid(),
    providerId: 'ppio',
    mode: 'generate',
    model: PPIO_MODELS[0]?.id ?? 'jimeng-txt2img-v3.1',
    prompt: '',
    files: []
  }
}
