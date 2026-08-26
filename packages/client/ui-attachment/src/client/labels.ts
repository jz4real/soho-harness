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
  card: (type: string, name: string, size: string) => string
  remove: (name: string) => string
}

type AttachmentDropLimits = {
  readonly files: { readonly count: number; readonly size: string; readonly total: string }
  readonly images?: { readonly count: number; readonly size: string; readonly total: string } | undefined
}

type LegacyImageDropLimits = { readonly count: number; readonly size: string }

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
      card: (type, name, size) => `${type}, ${name}, ${size}, Ready to send`,
      remove: name => `Remove file ${name}`,
    }
  }
  return {
    group: '待发送文件',
    ready: '已准备发送',
    unnamed: '未命名文件',
    card: (type, name, size) => `${type}，${name}，${size}，已准备发送`,
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
 * @param limits - optional display-ready file/image policies (or the legacy image-only projection).
 * @returns translated drop-overlay labels.
 */
export function dropOverlayLabels(
  t: TranslateNS<'conversation'>,
  accepting: boolean,
  limits?: AttachmentDropLimits | LegacyImageDropLimits,
): DropOverlayLabels {
  if (!accepting) return { title: english(t) ? 'Attachments cannot be added right now' : '当前无法添加附件' }
  const isEnglish = english(t)
  const desc = limits === undefined
    ? undefined
    : 'files' in limits
      ? [
        isEnglish
          ? `Files: up to ${String(limits.files.count)}, ${limits.files.size} each, ${limits.files.total} total`
          : `文件最多 ${String(limits.files.count)} 个，单个 ${limits.files.size}，总计 ${limits.files.total}`,
        ...(limits.images === undefined ? [] : [isEnglish
          ? `Images: up to ${String(limits.images.count)}, ${limits.images.size} each, ${limits.images.total} total`
          : `图片最多 ${String(limits.images.count)} 张，单张 ${limits.images.size}，总计 ${limits.images.total}`]),
      ].join(isEnglish ? '; ' : '；')
      : isEnglish
        ? `Images: up to ${String(limits.count)}, ${limits.size} each`
        : `图片最多 ${String(limits.count)} 张，单张 ${limits.size}`
  return {
    title: isEnglish ? 'Drop files or images here to add them' : '文件或图片拖动到此处即可添加',
    desc,
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
