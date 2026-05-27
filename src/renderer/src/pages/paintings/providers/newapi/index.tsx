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
      tabs: [
        { value: 'generate', labelKey: 'paintings.mode.generate' },
        { value: 'edit', labelKey: 'paintings.mode.edit' }
      ],
      defaultTab: 'generate',
      tabToDbMode: (tab: string) => tab,
      getModels: () => ({
        type: 'async',
        loader: () => loadPaintingModelOptions(providerId)
      }),
      createPaintingData: ({ modelOptions, tab }) => ({
        ...DEFAULT_PAINTING,
        id: uuid(),
        providerId,
        mode: tab === 'edit' ? 'edit' : 'generate',
        model: modelOptions?.[0]?.value || ''
      })
    },
    // Field list comes from the registry's per-model `imageGeneration` block
    // (size / quality / moderation / background / batch). No vendor extras —
    // newapi's gpt-image-1 schema is fully canonical.
    fields: {
      byTab: {},
      onModelChange: ({ modelId }) => ({ model: modelId, n: 1 })
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

export { NewApiSetting } from './sidebar'
