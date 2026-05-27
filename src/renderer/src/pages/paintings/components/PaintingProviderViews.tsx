import type { Model } from '@shared/data/types/model'

import type { PaintingData, TokenFluxPaintingData } from '../model/types/paintingData'
import type { ModelOption } from '../model/types/paintingModel'
import type { PaintingProviderRuntime } from '../model/types/paintingProviderRuntime'
import { DmxapiSetting } from '../providers/dmxapi'
import { TokenFluxCenterContent, TokenFluxSetting } from '../providers/tokenflux'
import Artboard from './Artboard'

function isTokenFluxPainting(painting: PaintingData): painting is TokenFluxPaintingData {
  return painting.providerId === 'tokenflux'
}

function isRegistryModel(value: unknown): value is Model {
  return Boolean(
    value && typeof value === 'object' && 'id' in value && 'providerId' in value && 'capabilities' in value
  )
}

export function PaintingSettingsExtras({
  provider,
  painting,
  selectedModelOption,
  patchPainting,
  tab
}: {
  provider: PaintingProviderRuntime
  painting: PaintingData
  modelOptions: ModelOption[]
  selectedModelOption?: ModelOption
  isLoading: boolean
  patchPainting: (updates: Partial<PaintingData>) => void
  tab: string
}) {
  if (provider.id === 'dmxapi') {
    return <DmxapiSetting paintingId={painting.id} mode={tab} />
  }

  if (provider.id === 'tokenflux') {
    if (!isTokenFluxPainting(painting)) {
      return null
    }

    return (
      <TokenFluxSetting
        painting={painting}
        patchPainting={(updates) => patchPainting(updates as Partial<PaintingData>)}
        selectedModel={isRegistryModel(selectedModelOption?.raw) ? selectedModelOption.raw : undefined}
      />
    )
  }

  // newapi / cherryin / aionly: edit-mode UI was retired — the prompt-box
  // attachment now drives `/v1/images/edits` routing via
  // `painting.inputFiles`. No vendor sidebar needed.
  return null
}

export function PaintingArtboard({
  painting,
  isLoading,
  onCancel
}: {
  painting: PaintingData
  isLoading: boolean
  onCancel: () => void
}) {
  if (isTokenFluxPainting(painting)) {
    return <TokenFluxCenterContent painting={painting} isLoading={isLoading} onCancel={onCancel} />
  }

  return <Artboard painting={painting} isLoading={isLoading} onCancel={onCancel} />
}
