import { createPaintingGenerateError } from '@renderer/aiCore/errors/paintingGenerateError'

import { canonicalGenerate } from '../../model/canonicalGenerate'
import type { DmxapiPaintingData as DmxapiPainting } from '../../model/types/paintingData'
import type { GenerateInput } from '../types'

/**
 * Unified DMXAPI painting adapter.
 *
 * DMXAPI's request shape (V1 JSON / V2 FormData, Bearer auth, `extend_params`,
 * seed `-1` sentinel, inline-base64 / FormData blobs) lives in the polling
 * transport; this file only feeds the canonical `generatePainting` pipeline
 * with DMXAPI's vendor extras via `providerBag`.
 *
 * Attached images come from `painting.inputFiles` (v2 FileEntries written by
 * the prompt-box attachment surface). Mode is derived from how many were
 * attached: zero → generate (`/v1/images/generations`), one → edit, two or
 * more → merge (both route through `/v1/images/edits` FormData). The bytes
 * are read off the v2 file IPC and forwarded by reference through
 * `providerOptions['dmxapi'].imageFiles` so the transport branches stay
 * byte-identical to the original implementation.
 *
 * Typed 401/403 errors map to `REQ_ERROR_TOKEN`/`REQ_ERROR_NO_BALANCE` in the
 * transport (R3). URL outputs accept inline base64 data URLs (some DMXAPI
 * models return them in the URL slot) via `allowBase64DataUrls: true`.
 */
export async function generateWithDmxapiUnified(input: GenerateInput<DmxapiPainting>) {
  const { painting } = input
  const inputFiles = painting.inputFiles ?? []
  const mode = inputFiles.length === 0 ? 'generate' : inputFiles.length === 1 ? 'edit' : 'merge'

  // Pre-fetch the upload bytes off the file IPC so the providerBag callback
  // (which canonicalGenerate invokes sync) can hand them off by reference.
  // `binaryImage` returns `{ data, mime }`; internal entries live at
  // `{userData}/Data/Files/{id}.{ext}` so the v1 IPC resolves them by name.
  const imageFiles = await Promise.all(
    inputFiles.map(async (entry) => {
      const onDiskName = `${entry.id}${entry.ext ? `.${entry.ext}` : ''}`
      const result = await window.api.file.binaryImage(onDiskName)
      return {
        mediaType: result.mime || 'application/octet-stream',
        data: new Uint8Array(result.data),
        name: `${entry.name}${entry.ext ? `.${entry.ext}` : ''}`
      }
    })
  )

  return canonicalGenerate(input, {
    preValidate: (p) => {
      if (!p.prompt) throw createPaintingGenerateError('TEXT_DESC_REQUIRED')
    },
    fieldMap: { imageSize: 'image_size', batchSize: 'n' },
    providerBag: (p) => ({
      model: p.model,
      n: p.n,
      imageSize: p.image_size,
      seed: p.seed,
      mode,
      extendParams: p.extend_params,
      imageFiles
    }),
    downloadOptions: { allowBase64DataUrls: true }
  })
}
