import { uuid } from '@renderer/utils'

import type { OvmsPaintingData } from '../../model/types/paintingData'

/**
 * Sentinel shown in the model dropdown when the user has no enabled
 * OVMS image-gen model. The `prompt.disabled` predicate compares the
 * current painting's model against this value to gate the prompt input.
 */
export const OVMS_MODELS: Array<{ label: string; value: string }> = [{ label: 'no available model', value: 'none' }]

export function createDefaultOvmsPainting(models?: Array<{ label: string; value: string }>): OvmsPaintingData {
  const availableModels = models || OVMS_MODELS
  return {
    id: uuid(),
    providerId: 'ovms',
    mode: 'generate',
    model: availableModels[0]?.value || 'Select Model Here',
    prompt: '',
    files: []
  }
}
