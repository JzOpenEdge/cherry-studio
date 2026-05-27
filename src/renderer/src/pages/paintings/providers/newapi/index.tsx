import i18n from '@renderer/i18n'
import { uuid } from '@renderer/utils'

import type { OpenApiCompatiblePaintingData as PaintingData } from '../../model/types/paintingData'
import { loadPaintingModelOptions } from '../../model/utils/paintingModelOptions'
import type { PaintingProvider, PaintingProviderDefinition } from '../types'
import { DEFAULT_PAINTING } from './config'
import { generateWithNewApiUnified } from './generateUnified'

export function createNewApiProvider(providerId: string): PaintingProviderDefinition {
  const provider = {
    id: providerId,
    mode: {
      tabs: [{ value: 'generate', labelKey: 'paintings.mode.generate' }],
      defaultTab: 'generate',
      tabToDbMode: () => 'generate',
      getModels: () => ({
        type: 'async',
        loader: () => loadPaintingModelOptions(providerId)
      }),
      createPaintingData: ({ modelOptions }) => ({
        ...DEFAULT_PAINTING,
        id: uuid(),
        providerId,
        mode: 'generate',
        model: modelOptions?.[0]?.value || ''
      })
    },
    // Field list comes from the registry's per-model `imageGeneration` block
    // (size / quality / moderation / background / batch). No vendor extras —
    // newapi's gpt-image-1 schema is fully canonical. Edit-mode is no longer
    // a separate tab; the user attaches an image through the prompt box and
    // `generateWithNewApiUnified` routes to `/v1/images/edits` based on
    // `painting.inputFiles.length`.
    fields: {
      byTab: {},
      onModelChange: ({ modelId }) => ({ model: modelId })
    },
    prompt: {
      placeholder: ({ painting }) => {
        if (painting.model?.startsWith('imagen-')) return i18n.t('paintings.prompt_placeholder_en')
        return i18n.t('paintings.prompt_placeholder_edit')
      }
    },
    generate: (input) => generateWithNewApiUnified(input)
  } satisfies PaintingProvider<PaintingData>

  return provider
}
