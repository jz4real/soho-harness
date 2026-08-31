/** Durable attachment storage seam (`ctx.attachments`). @module @deepseek-ai/dsh-attachment */

import { Context, Service } from '@deepseek-ai/cordis'
import { AttachmentError } from './error.ts'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestPolicy,
  RequestImageAttachment,
  FileAttachmentLimits,
  FileAttachmentRef,
  SaveFileAttachment,
  SaveImageAttachment,
  StoredFileAttachment,
  StoredImageAttachment,
} from './types.ts'

export { AttachmentId, ImageVariantId } from './brand.ts'
export { AttachmentError, isFileAdmissionError, isImageAdmissionError } from './error.ts'
export type { AttachmentErrorCode, FileAdmissionErrorCode, ImageAdmissionErrorCode } from './error.ts'
export { admitEncodedImages, decodeEncodedFiles } from './admission.ts'
export type {
  AttachmentId as AttachmentIdType,
  EncodedFileAttachment,
  EncodedImageAttachment,
  FileAttachmentLimits,
  FileAttachmentRef,
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestPolicy,
  ImageMediaType,
  RequestImageAttachment,
  SaveFileAttachment,
  SaveImageAttachment,
  StoredFileAttachment,
  StoredImageAttachment,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    attachments: AttachmentStore
  }
}

/** Immutable binary attachment service. Implementations validate bytes before publishing a reference. */
export abstract class AttachmentStore extends Service {
  constructor(ctx: Context) {
    super(ctx, 'attachments')
  }

  /** Deployment-resolved image policy used by authoritative and fast-path validation. */
  abstract readonly imageLimits: ImageAttachmentLimits

  /** Deployment-resolved generic-file policy used by authoritative validation. */
  readonly fileLimits: FileAttachmentLimits = Object.freeze({
    maxFileBytes: 20 * 1024 * 1024,
    maxFilesPerMessage: 10,
    maxMessageFileBytes: 50 * 1024 * 1024,
  })

  /**
   * Validate one image without persisting it.
   * Batch callers validate every member before saving any member.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns completion after the encoded raster has been fully decoded.
   */
  abstract validateImage(input: SaveImageAttachment): Promise<void>

  /**
   * Validate one ordered image batch before committing any member.
   * Validation failures start no writes; storage failures return no partial
   * references, although already published content-addressed objects may stay
   * unreachable until a future retention policy collects them.
   * @param inputs - encoded images in their owning message order.
   * @returns durable references in the exact input order.
   */
  protected validateImageBatch(inputs: readonly SaveImageAttachment[]): void {
    const { maxImagesPerMessage, maxMessageImageBytes, mediaTypes } = this.imageLimits
    if (inputs.length > maxImagesPerMessage) {
      throw new AttachmentError('Image batch exceeds the configured image-count limit.', 'TOO_MANY_IMAGES')
    }
    const totalBytes = inputs.reduce((sum, input) => sum + input.data.byteLength, 0)
    if (totalBytes > maxMessageImageBytes) {
      throw new AttachmentError('Image batch exceeds the configured aggregate image-byte limit.', 'IMAGES_TOO_LARGE')
    }
    for (const input of inputs) {
      if (!mediaTypes.includes(input.mediaType)) {
        throw new AttachmentError(`Image type ${input.mediaType} is not accepted by this deployment.`, 'UNSUPPORTED_IMAGE_TYPE')
      }
    }
  }

  /**
   * Validate and durably commit one ordered image batch.
   * @param inputs - encoded images in owning-message order.
   * @returns durable normalized attachment references in the same order after every member succeeds.
   */
  async saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]> {
    this.validateImageBatch(inputs)
    for (const input of inputs) await this.validateImage(input)

    const refs: ImageAttachmentRef[] = []
    for (const input of inputs) refs.push(await this.saveImage(input))
    return refs
  }

  /**
   * Validate and durably commit one image before its owning session event is appended.
   * The returned reference describes the persisted normalized image. When
   * normalization reduces the raster, its `originalDimensions` records the
   * orientation-applied input dimensions.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns the durable content-addressed normalized image reference.
   */
  abstract saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>

  /**
   * Read one image and verify that bytes still match the recorded reference.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and normalized attachment reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  abstract readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>

  /** Validate one generic-file batch before committing any member. */
  protected validateFileBatch(inputs: readonly SaveFileAttachment[]): void {
    const { maxFileBytes, maxFilesPerMessage, maxMessageFileBytes } = this.fileLimits
    if (inputs.length > maxFilesPerMessage) {
      throw new AttachmentError('File batch exceeds the configured file-count limit.', 'TOO_MANY_FILES')
    }
    const totalBytes = inputs.reduce((sum, input) => sum + input.data.byteLength, 0)
    if (totalBytes > maxMessageFileBytes) {
      throw new AttachmentError('File batch exceeds the configured aggregate file-byte limit.', 'FILES_TOO_LARGE')
    }
    for (const input of inputs) {
      if (input.data.byteLength > maxFileBytes) {
        throw new AttachmentError('File exceeds the configured byte limit.', 'FILE_TOO_LARGE')
      }
    }
  }

  /**
   * Validate and durably commit an ordered generic-file batch.
   * @param inputs - original file bytes and optional metadata, in message order.
   * @returns durable file references in the same order as `inputs`.
   */
  async saveFiles(inputs: readonly SaveFileAttachment[]): Promise<readonly FileAttachmentRef[]> {
    this.validateFileBatch(inputs)
    const refs: FileAttachmentRef[] = []
    for (const input of inputs) refs.push(await this.saveFile(input))
    return refs
  }

  /**
   * Persist one generic file, retaining its original bytes.
   * @param _input - original file bytes and optional metadata to persist.
   * @returns a rejected promise when the mounted provider does not support generic files.
   */
  saveFile(_input: SaveFileAttachment): Promise<FileAttachmentRef> {
    return Promise.reject(new AttachmentError(
      'The mounted attachment provider cannot store generic files.',
      'ATTACHMENT_PROJECTION_UNSUPPORTED',
    ))
  }

  /**
   * Read one original file and verify that bytes still match its reference.
   * @param _ref - durable reference identifying the expected original bytes.
   * @param _signal - optional cancellation for the provider read and verification work.
   * @returns a rejected promise when the mounted provider does not support generic files.
   */
  readFile(_ref: FileAttachmentRef, _signal?: AbortSignal): Promise<StoredFileAttachment> {
    return Promise.reject(new AttachmentError(
      'The mounted attachment provider cannot read generic files.',
      'ATTACHMENT_PROJECTION_UNSUPPORTED',
    ))
  }

  /**
   * Generate or read one deterministic model-request version from the stored normalized image.
   * @param ref - durable provider-independent normalized attachment reference.
   * @param policy - exact route pixel and encoded-byte budget.
   * @param signal - optional cancellation.
   * @returns request bytes and the cache/upload identity covering every transform input.
   */
  readImageRequest(
    ref: ImageAttachmentRef,
    policy: ImageRequestPolicy,
    signal?: AbortSignal,
  ): Promise<RequestImageAttachment> {
    signal?.throwIfAborted()
    void ref
    void policy
    return Promise.reject(new AttachmentError(
      'The mounted attachment provider cannot derive model-request images.',
      'ATTACHMENT_PROJECTION_UNSUPPORTED',
    ))
  }

}

export default AttachmentStore
