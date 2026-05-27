import { uuid } from '@renderer/utils'

import type { ModelOption } from '../../model/types/paintingModel'

export const generateSiliconRandomSeed = () => Math.floor(Math.random() * 1000000).toString()

export function createDefaultSiliconPainting(modelOptions?: ModelOption[]) {
  return {
    id: uuid(),
    providerId: 'silicon' as const,
    mode: 'generate' as const,
    files: [],
    prompt: '',
    // Seed stays client-generated so the user can SEE the value and copy it
    // for reproducible reruns; every other knob (size/numImages/steps/cfg)
    // is left unset so the server picks its model-aware default.
    seed: generateSiliconRandomSeed(),
    model: modelOptions?.[0]?.value ?? ''
  }
}
