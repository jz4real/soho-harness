import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComposerAttachment, ComposerAttachmentsProps,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { IconCloseFill14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { AttachmentRail } from '../AttachmentRail.tsx'
import type { AttachmentRailItem } from '../AttachmentRail.tsx'
import { DropOverlay } from '../DropOverlay.tsx'
import { ImageLightbox } from '../ImageLightbox.tsx'
import { attachmentRailLabels, dropOverlayLabels, fileCardLabels, lightboxLabels } from './labels.ts'
import css from './ComposerAttachments.module.css'

type ComposerImageAttachment = Extract<ComposerAttachment, { kind: 'image' }>
type ComposerFileAttachment = Extract<ComposerAttachment, { kind: 'file' }>

/** Rail item retaining its browser-owned attachment for callbacks. */
interface ComposerRailItem extends AttachmentRailItem {
  attachment: ComposerImageAttachment
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${formatSize(bytes / 1024)} KB`
  return `${formatSize(bytes / (1024 * 1024))} MB`
}

function formatSize(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** Draft file cards, image rail, document drop target, and original-image preview slot entry. */
export function ComposerAttachments({
  attachments, canAcceptDrop, onAddAttachments, onRemoveAttachment, dropLimits, t,
}: ComposerAttachmentsProps) {
  const [preview, setPreview] = useState<ComposerImageAttachment | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)
  const closePreview = useCallback(() => { setPreview(null) }, [])

  useEffect(() => {
    if (preview !== null && !attachments.some(attachment => attachment.id === preview.id)) setPreview(null)
  }, [attachments, preview])

  useEffect(() => {
    const fileTransfer = (event: globalThis.DragEvent): DataTransfer | null => {
      const dataTransfer = event.dataTransfer
      if (dataTransfer === null || !dataTransfer.types.includes('Files')) return null
      return dataTransfer
    }
    const reset = (): void => {
      dragDepth.current = 0
      setDragActive(false)
    }
    const onDragEnter = (event: globalThis.DragEvent): void => {
      if (fileTransfer(event) === null) return
      event.preventDefault()
      dragDepth.current += 1
      setDragActive(true)
    }
    const onDragOver = (event: globalThis.DragEvent): void => {
      const dataTransfer = fileTransfer(event)
      if (dataTransfer === null) return
      event.preventDefault()
      dataTransfer.dropEffect = canAcceptDrop ? 'copy' : 'none'
    }
    const onDragLeave = (event: globalThis.DragEvent): void => {
      if (fileTransfer(event) === null) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragActive(false)
      const leftViewport = event.clientX <= 0 || event.clientY <= 0
        || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight
      if ((event.target === document.documentElement || event.target === document.body) && leftViewport) reset()
    }
    const onDrop = (event: globalThis.DragEvent): void => {
      const dataTransfer = fileTransfer(event)
      if (dataTransfer === null) return
      event.preventDefault()
      reset()
      if (canAcceptDrop) onAddAttachments([...dataTransfer.files])
    }
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    window.addEventListener('dragend', reset)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', reset)
    }
  }, [canAcceptDrop, onAddAttachments])

  const images = useMemo(
    () => attachments.filter((attachment): attachment is ComposerImageAttachment => attachment.kind === 'image'),
    [attachments],
  )
  const files = useMemo(
    () => attachments.filter((attachment): attachment is ComposerFileAttachment => attachment.kind === 'file'),
    [attachments],
  )
  const railItems = useMemo<ComposerRailItem[]>(() => images.map(attachment => ({
    id: attachment.id,
    previewUrl: attachment.previewUrl,
    alt: attachment.file.name || t('image.pending'),
    removeLabel: t('image.remove', { name: attachment.file.name }),
    attachment,
  })), [images, t])
  const fileLabels = fileCardLabels(t)

  return (
    <>
      {dragActive && (
        <DropOverlay
          disabled={!canAcceptDrop}
          labels={dropOverlayLabels(t, canAcceptDrop, dropLimits)}
        />
      )}
      {(files.length > 0 || railItems.length > 0) && (
        <div className={css.attachments}>
          {files.length > 0 && (
            <div className={css.cards} role="list" aria-label={fileLabels.group}>
              {files.map((attachment) => {
                const name = attachment.file.name || fileLabels.unnamed
                return (
                  <div key={attachment.id} className={css.card} role="listitem">
                    <span className={css.badge} aria-hidden>{attachment.fileType.toUpperCase()}</span>
                    <span className={css.details}>
                      <span className={css.filename} title={name}>{name}</span>
                      <span className={css.meta}>
                        <span>{humanFileSize(attachment.file.size)}</span>
                        <span aria-hidden>·</span>
                        <span className={css.ready}>{fileLabels.ready}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      className={css.remove}
                      aria-label={fileLabels.remove(name)}
                      onClick={() => { onRemoveAttachment(attachment.id) }}
                    >
                      <IconCloseFill14 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {railItems.length > 0 && (
            <div className={css.rail}>
              <AttachmentRail
                items={railItems}
                labels={attachmentRailLabels(t)}
                onOpen={(item) => { setPreview(item.attachment) }}
                onRemove={(item) => { onRemoveAttachment(item.attachment.id) }}
              />
            </div>
          )}
        </div>
      )}
      {preview !== null && (
        <ImageLightbox
          src={preview.previewUrl}
          alt={preview.file.name || t('image.original')}
          labels={lightboxLabels(t)}
          onClose={closePreview}
        />
      )}
    </>
  )
}
