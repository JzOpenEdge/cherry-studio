import { uuid } from '@renderer/utils'

import type { OpenApiCompatiblePaintingData as GeneratePainting } from '../../model/types/paintingData'

export const DEFAULT_PAINTING: GeneratePainting = {
  id: uuid(),
  providerId: '',
  mode: 'generate',
  files: [],
  model: '',
  prompt: '',
  quality: 'auto',
  n: 1,
  background: 'auto',
  moderation: 'auto',
  size: 'auto'
}
