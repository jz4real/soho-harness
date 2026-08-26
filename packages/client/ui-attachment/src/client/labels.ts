import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttachmentRailLabels } from '../AttachmentRail.tsx'
import type { DropOverlayLabels } from '../DropOverlay.tsx'
import type { ImageLightboxLabels } from '../ImageLightbox.tsx'
import type { MessageImageLabels } from '../MessageImage.tsx'

/** Resolved strings for generic draft-file cards. */
export interface FileCardLabels {
  group: string
  ready: string
  unnamed: string
  remove: (name: string) => string
}

function english(t: TranslateNS<'conversation'>): boolean {
  return t('input.send') === 'Send message'
}

/** Resolve generic draft-file card strings for the active conversation locale. */
export function fileCardLabels(t: TranslateNS<'conversation'>): FileCardLabels {
  if (english(t)) {
    return {
      group: 'Files ready to send',
      ready: 'Ready to send',
      unnamed: 'Unnamed file',
      remove: name => `Remove file ${name}`,
    }
  }
  return {
    group: '待发送文件',
    ready: '已准备发送',
    unnamed: '未命名文件',
    remove: name => `移除文件 ${name}`,
  }
}

/**
 * Resolve original-image lightbox strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated lightbox labels.
 */
export function lightboxLabels(t: TranslateNS<'conversation'>): ImageLightboxLabels {
  return { dialog: t('image.preview'), close: t('image.closePreview') }
}

/**
 * Resolve historical message-image strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated message-image labels.
 */
export function messageImageLabels(t: TranslateNS<'conversation'>): MessageImageLabels {
  return {
    image: t('image.label'),
    open: t('image.openOriginal'),
    openNamed: label => t('image.openOriginalLabel', { label }),
    loading: t('image.loading'),
    loadFailed: t('image.loadFailed'),
    lightbox: lightboxLabels(t),
  }
}

/**
 * Resolve the document-level drop invitation and its optional limits line.
 * @param t - conversation namespace translator.
 * @param accepting - whether the composer can accept dropped files.
 * @param limits - optional translated count and size values.
 * @returns translated drop-overlay labels.
 */
export function dropOverlayLabels(
  t: TranslateNS<'conversation'>,
  accepting: boolean,
  limits?: { readonly count: number; readonly size: string },
): DropOverlayLabels {
  if (!accepting) return { title: english(t) ? 'Attachments cannot be added right now' : '当前无法添加附件' }
  return {
    title: english(t) ? 'Drop files or images here to add them' : '文件或图片拖动到此处即可添加',
    desc: limits === undefined ? undefined : t('image.dropDesc', limits),
  }
}

/**
 * Resolve draft-image rail strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated attachment-rail labels.
 */
export function attachmentRailLabels(t: TranslateNS<'conversation'>): AttachmentRailLabels {
  return {
    group: t('image.pending'),
    open: t('image.openOriginal'),
    scrollLeft: t('image.scrollLeft'),
    scrollRight: t('image.scrollRight'),
  }
}
