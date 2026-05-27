import { dataApiService } from '@data/DataApiService'
import { loggerService } from '@logger'
import type { FileMetadata } from '@renderer/types'
import type { FileEntry } from '@shared/data/types/file/fileEntry'
import { isUniqueModelId, parseUniqueModelId } from '@shared/data/types/model'
import type { Painting as PaintingRecord } from '@shared/data/types/painting'

import { fileEntryToMetadata } from '../../utils/fileEntryAdapter'
import type { PaintingData } from '../types/paintingData'

const logger = loggerService.withContext('paintings/recordToPaintingData')

/** Maps DB `painting.model_id` into the renderer's API model slug (never the user_model row id alone). */
function normalizeStoredPaintingModel(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (isUniqueModelId(trimmed)) {
    try {
      return parseUniqueModelId(trimmed).modelId
    } catch {
      return trimmed
    }
  }
  return trimmed
}

/**
 * Look up v2 `FileEntry` rows by id via DataApi. Missing ids (404 / migrator
 * drop / user deletion) are filtered out so the painting still hydrates with
 * whatever files do resolve.
 */
async function fetchFileEntries(ids: string[]): Promise<FileEntry[]> {
  if (ids.length === 0) return []
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        return (await dataApiService.get(`/files/entries/${id}` as never)) as FileEntry
      } catch (error) {
        logger.warn('Skipping unresolved file_entry for painting', { id, error })
        return null
      }
    })
  )
  return entries.filter((e): e is FileEntry => e !== null)
}

/**
 * Adapt output `FileEntry`s to the v1 `FileMetadata` shape the Artboard still
 * consumes. TODO(#15353): drop this adapter once the
 * `cherrystudio://file/internal/{uuid}.{ext}` custom protocol lands and the
 * Artboard switches to that scheme — `painting.files` will then carry
 * `FileEntry[]` directly.
 */
async function resolveOutputFiles(ids: string[]): Promise<FileMetadata[]> {
  const entries = await fetchFileEntries(ids)
  return Promise.all(entries.map(fileEntryToMetadata))
}

/**
 * Hydrate a persisted painting record (frozen receipt: prompt + files) into
 * the renderer's PaintingData draft shape. The DB record carries no mode,
 * mediaType, or params — those are live form-state concerns. The draft built
 * here defaults `mode` to `'generate'` so callers that select a past painting
 * land on the generate tab; the form will overwrite this when the user picks
 * a different tab.
 */
export async function recordToPaintingData(record: PaintingRecord): Promise<PaintingData> {
  const [files, inputFiles] = await Promise.all([
    resolveOutputFiles(record.files.output),
    fetchFileEntries(record.files.input)
  ])

  const model = normalizeStoredPaintingModel(record.modelId)

  return {
    id: record.id,
    providerId: record.providerId,
    mode: 'generate',
    prompt: record.prompt,
    files,
    inputFiles,
    persistedAt: record.createdAt,
    model
  } as PaintingData
}

export function recordsToPaintingDataList(records: PaintingRecord[]): Promise<PaintingData[]> {
  return Promise.all(records.map(recordToPaintingData))
}
