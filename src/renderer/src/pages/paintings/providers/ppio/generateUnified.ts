import { createPaintingGenerateError } from '@renderer/aiCore/errors/paintingGenerateError'
import type { FileEntry } from '@shared/data/types/file/fileEntry'

import { canonicalGenerate } from '../../model/canonicalGenerate'
import type { PpioPaintingData as PpioPainting } from '../../model/types/paintingData'
import type { GenerateInput } from '../types'
import { getModelConfig, type PpioMode } from './models'

/** Models that accept an empty prompt (the painting page enforces non-empty by default). */
const NO_PROMPT_MODELS = new Set(['image-upscaler', 'image-remove-background', 'image-eraser'])

/**
 * Pick the right `PpioMode` for an outbound request:
 *  - Model only appears under one mode in `PPIO_MODELS` → that mode wins.
 *  - Model appears under both (seedream-4.5 / seedream-5.0-lite / …) → attached
 *    image switches `ppio_draw` to `ppio_edit`.
 *  - Unknown model → fall back to draw; `preValidate` then surfaces the
 *    missing-routing-config error.
 */
function resolvePpioMode(modelId: string | undefined, hasInput: boolean): PpioMode {
  if (!modelId) return 'ppio_draw'
  const draw = getModelConfig(modelId, 'ppio_draw')
  const edit = getModelConfig(modelId, 'ppio_edit')
  if (draw && edit) return hasInput ? 'ppio_edit' : 'ppio_draw'
  return edit && !draw ? 'ppio_edit' : 'ppio_draw'
}

async function fileEntryToDataUrl(entry: FileEntry): Promise<string> {
  const onDiskName = `${entry.id}${entry.ext ? `.${entry.ext}` : ''}`
  const result = await window.api.file.binaryImage(onDiskName)
  const blob = new Blob([new Uint8Array(result.data)], { type: result.mime || 'application/octet-stream' })
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Unified PPIO painting adapter.
 *
 * PPIO's transport (submit/poll via `PpioTransport`) lives in the custom
 * `ImageModelV3`; signed-CDN URL results route back through the main-process
 * `downloadImages` (R1). Per-model endpoint routing and sync/async dispatch
 * come from `PPIO_MODELS` (transport routing table, not a UI catalog) — the
 * dropdown source itself is the user's enabled image-gen models filtered by
 * `loadPaintingModelOptions(providerId)`.
 *
 * Mode comes from the selected model + whether the user attached an image
 * (via the prompt-box attachment surface, persisted on `painting.inputFiles`):
 * the first attached entry's bytes become the `imageFile` data URL the
 * transport reads off the provider bag.
 *
 * `onProgress` / `onSubmitTaskId` callbacks are forwarded via providerBag so
 * non-JSON references survive the AI-SDK plugin chain to PpioTransport.
 */
export async function generateWithPpioUnified(input: GenerateInput<PpioPainting>) {
  const inputFiles = input.painting.inputFiles ?? []
  const ppioMode = resolvePpioMode(input.painting.model, inputFiles.length > 0)
  const imageFile = inputFiles.length > 0 ? await fileEntryToDataUrl(inputFiles[0]) : undefined

  return canonicalGenerate(input, {
    requirePrompt: (painting) => !painting.model || !NO_PROMPT_MODELS.has(painting.model),
    preValidate: (painting) => {
      const modelId = painting.model
      if (!modelId) return // canonicalGenerate's MISSING_REQUIRED_FIELDS will fire next
      if (!getModelConfig(modelId, ppioMode)) throw createPaintingGenerateError('MISSING_REQUIRED_FIELDS')
      if (ppioMode === 'ppio_edit' && !imageFile) {
        throw createPaintingGenerateError('EDIT_IMAGE_REQUIRED')
      }
    },
    fieldMap: { imageSize: 'size' },
    providerBag: (painting) => {
      const modelConfig = painting.model ? getModelConfig(painting.model, ppioMode) : undefined
      return {
        model: painting.model,
        modelDescriptor: modelConfig
          ? { id: modelConfig.id, endpoint: modelConfig.endpoint, isSync: modelConfig.isSync, mode: modelConfig.mode }
          : undefined,
        size: painting.size,
        ppioSeed: painting.ppioSeed,
        usePreLlm: painting.usePreLlm,
        addWatermark: painting.addWatermark,
        imageFile,
        ppioMask: painting.ppioMask,
        resolution: painting.resolution,
        outputFormat: painting.outputFormat,
        onProgress: (progress: number) => {
          input.onGenerationStateChange?.({ generationProgress: progress })
        },
        onSubmitTaskId: (taskId: string) => {
          input.onGenerationStateChange?.({ generationTaskId: taskId })
        }
      }
    }
  })
}
