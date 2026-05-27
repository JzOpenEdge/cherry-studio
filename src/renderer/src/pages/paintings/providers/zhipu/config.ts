import { uuid } from '@renderer/utils'

import type { ModelOption } from '../../model/types/paintingModel'

export function createDefaultZhipuPainting(modelOptions?: ModelOption[]) {
  return {
    id: uuid(),
    providerId: 'zhipu' as const,
    mode: 'generate' as const,
    files: [],
    prompt: '',
    model: modelOptions?.[0]?.value ?? ''
  }
}
