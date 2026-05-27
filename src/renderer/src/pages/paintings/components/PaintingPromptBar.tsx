import { Button, Textarea } from '@cherrystudio/ui'
import { cn } from '@cherrystudio/ui/lib/utils'
import { loggerService } from '@logger'
import SendMessageButton from '@renderer/pages/home/Inputbar/SendMessageButton'
import type { FileEntry } from '@shared/data/types/file/fileEntry'
import { Paperclip, X } from 'lucide-react'
import {
  type ChangeEventHandler,
  type FC,
  type KeyboardEventHandler,
  type ReactNode,
  useCallback,
  useMemo,
  useRef
} from 'react'
import { useTranslation } from 'react-i18next'

import { useImageGenerationSupport } from '../hooks/useImageGenerationSupport'
import type { PaintingData } from '../model/types/paintingData'
import { resolvePaintingProviderDefinition } from '../utils/paintingProviderMode'

const logger = loggerService.withContext('PaintingPromptBar')

interface PaintingPromptBarProps {
  painting: PaintingData
  generating: boolean
  leadingActions?: ReactNode
  onPromptChange: (value: string) => void
  onInputFilesChange: (entries: FileEntry[]) => void
  onGenerate: () => void
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
}

/**
 * A model accepts an attached image when it advertises any image-generation
 * mode other than `'generate'` (edit / remix / upscale / merge — all
 * image-input modes by definition). The attachment button is gated on this
 * predicate so paintings only offers an upload the model can actually use.
 */
function modelAcceptsImageInput(modes: readonly string[] | undefined): boolean {
  if (!modes) return false
  return modes.some((mode) => mode !== 'generate')
}

const PaintingPromptBar: FC<PaintingPromptBarProps> = ({
  painting,
  generating,
  leadingActions,
  onPromptChange,
  onInputFilesChange,
  onGenerate,
  onKeyDown
}) => {
  const { t } = useTranslation()
  const definition = useMemo(() => resolvePaintingProviderDefinition(painting.providerId), [painting.providerId])
  const placeholder = definition.prompt?.placeholder?.({ painting }) ?? t('paintings.prompt_placeholder')
  const disabled = definition.prompt?.disabled?.({ painting, isLoading: generating }) ?? generating

  const support = useImageGenerationSupport(painting.providerId, painting.model)
  const acceptsImageInput = useMemo(() => modelAcceptsImageInput(support?.modes), [support])

  const inputFiles = useMemo(() => painting.inputFiles ?? [], [painting.inputFiles])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAttach = useCallback(
    async (files: FileList | File[]) => {
      const next: FileEntry[] = [...inputFiles]
      for (const file of Array.from(files)) {
        try {
          const buffer = await file.arrayBuffer()
          const dotIdx = file.name.lastIndexOf('.')
          const baseName = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name
          const ext = dotIdx > 0 ? file.name.slice(dotIdx + 1).toLowerCase() : null
          const entry = (await window.api.file.createInternalEntry({
            source: 'bytes',
            data: new Uint8Array(buffer),
            name: baseName,
            ext
          })) as FileEntry
          next.push(entry)
        } catch (error) {
          logger.error(`Failed to attach ${file.name}`, error as Error)
        }
      }
      if (next.length !== inputFiles.length) onInputFilesChange(next)
    },
    [inputFiles, onInputFilesChange]
  )

  const handleFileInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    async (event) => {
      const files = event.target.files
      if (files && files.length > 0) await handleAttach(files)
      event.target.value = ''
    },
    [handleAttach]
  )

  const handleRemove = useCallback(
    async (entry: FileEntry) => {
      onInputFilesChange(inputFiles.filter((e) => e.id !== entry.id))
      // Best-effort cleanup — a still-referenced entry rejects via CASCADE
      // detection, and an unreferenced one becomes orphan-sweep fodder.
      try {
        await window.api.file.permanentDelete({ kind: 'entry', entryId: entry.id })
      } catch (error) {
        logger.warn('Failed to delete attached file_entry', error as Error)
      }
    },
    [inputFiles, onInputFilesChange]
  )

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col">
      {inputFiles.length > 0 && (
        <div className="flex w-full min-w-0 shrink-0 flex-wrap gap-2 px-1 pb-2">
          {inputFiles.map((entry) => (
            <div
              key={entry.id}
              className="flex max-w-60 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-foreground/85 text-xs">
              <span className="truncate">
                {entry.name}
                {entry.ext ? `.${entry.ext}` : ''}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                onClick={() => handleRemove(entry)}
                aria-label={t('common.delete')}>
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="relative flex h-27.5 w-full min-w-0 flex-col rounded-[1.25rem] border border-border bg-background">
        <Textarea.Input
          disabled={disabled}
          value={painting.prompt || ''}
          spellCheck={false}
          className={cn(
            'flex-1 resize-none border-0 bg-transparent px-4 pt-3 pb-1.5 text-foreground/85 text-sm shadow-none',
            'placeholder:text-muted-foreground/55 focus-visible:ring-0'
          )}
          placeholder={placeholder}
          onValueChange={onPromptChange}
          onKeyDown={onKeyDown}
        />
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-3.5 pt-2 pb-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {acceptsImageInput && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={disabled}
                  onClick={handlePickFiles}
                  aria-label={t('paintings.input_image')}>
                  <Paperclip size={14} />
                </Button>
              </>
            )}
            {leadingActions}
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <SendMessageButton sendMessage={onGenerate} disabled={disabled} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaintingPromptBar
