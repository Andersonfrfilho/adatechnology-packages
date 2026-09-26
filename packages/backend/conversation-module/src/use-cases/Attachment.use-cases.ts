/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF8: o anexo em três passos, portado de `conversation-attachment.service.ts` (spec 183).
 *
 * 1. **Pedido** (`RequestAttachmentUploadUseCase`): confere o declarado (tipo, teto do canal via
 *    `CHANNEL_CAPABILITIES`), grava o pedido e devolve a URL assinada de vida curta. A chave do
 *    objeto é só um token opaco de 256 bits — sem nome, sem id interno.
 * 2. **Ligação** (`LinkAttachmentUploadsUseCase`): cada pedido tem de estar `pending`, no prazo e
 *    ser desta conversa; os bytes têm de caber no teto e bater com a assinatura do tipo declarado.
 *    Só então grava o anexo, com o `sha256` dos bytes de verdade — nunca um byte de arquivo na
 *    linha. Os bytes conferidos são copiados para uma chave final nova antes de apagar a da
 *    subida: a URL de subida segue válida até expirar, e um PUT tardio nela não pode trocar o
 *    arquivo já conferido.
 * 3. **Leitura** (`CreateAttachmentDownloadUrlUseCase`): URL temporária curta.
 */
import { createHash, randomBytes } from 'node:crypto'

import { getChannelCapabilities } from '@adatechnology/conversation-contracts'
import type { ClockPort, ConversationChannel } from '@adatechnology/conversation-contracts'

import { attachmentKindOf, matchesAttachmentSignature, normalizeAttachmentFileName } from '../domain/attachmentType'
import {
  AttachmentNotFoundError,
  AttachmentTooLargeError,
  AttachmentTypeMismatchError,
  AttachmentsDisabledError,
  UploadExpiredError,
  UploadNotFoundError,
} from '../errors'
import type { ConversationAttachmentRow, ConversationUploadRow } from '../schema/schema'
import type { AttachmentRepositoryPort } from '../repositories/ports'
import type { ObjectStoragePort } from '@adatechnology/conversation-contracts'

/** Quinze minutos para subir — vida curta de propósito (mesmo prazo da spec 183/179). */
export const ATTACHMENT_UPLOAD_EXPIRES_IN_SECONDS = 900

/** A URL de leitura vale cinco minutos. */
export const ATTACHMENT_DOWNLOAD_EXPIRES_IN_SECONDS = 300

function newObjectKey(): string {
  return `conversation-attachments/${randomBytes(32).toString('base64url')}`
}

async function readAllBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export type RequestAttachmentUploadInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly channel: ConversationChannel
  readonly requestedByUserId: string
  readonly contentType: string
  readonly fileName: string
  readonly sizeBytes: number
}

export type RequestAttachmentUploadResult = {
  readonly uploadId: string
  readonly objectKey: string
  readonly uploadUrl: URL
  readonly expiresAt: Date
}

export type RequestAttachmentUploadDeps = {
  readonly attachments: AttachmentRepositoryPort
  readonly objectStorage: ObjectStoragePort | undefined
  readonly clock: ClockPort
  readonly bucket: string
}

export class RequestAttachmentUploadUseCase {
  constructor(private readonly deps: RequestAttachmentUploadDeps) {}

  async execute(input: RequestAttachmentUploadInput): Promise<RequestAttachmentUploadResult> {
    if (!this.deps.objectStorage) throw new AttachmentsDisabledError()

    const kind = attachmentKindOf(input.contentType)
    if (!kind) throw new AttachmentTypeMismatchError(input.contentType, undefined)

    const capability = getChannelCapabilities(input.channel).attachments
    if (
      !capability.accepted ||
      !Number.isInteger(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > capability.maxBytes
    ) {
      throw new AttachmentTooLargeError(input.sizeBytes, capability.maxBytes)
    }

    const objectKey = newObjectKey()
    const expiresAt = new Date(this.deps.clock.now().getTime() + ATTACHMENT_UPLOAD_EXPIRES_IN_SECONDS * 1000)

    const upload = await this.deps.attachments.createUpload({
      companyId: input.companyId,
      conversationId: input.conversationId,
      channel: input.channel,
      requestedByUserId: input.requestedByUserId,
      bucket: this.deps.bucket,
      objectKey,
      declaredContentType: input.contentType,
      declaredSizeBytes: input.sizeBytes,
      fileName: normalizeAttachmentFileName(input.fileName),
      expiresAt,
    })

    const uploadUrl = await this.deps.objectStorage.createSignedUpload({
      bucket: this.deps.bucket,
      key: objectKey,
      expiresInSeconds: ATTACHMENT_UPLOAD_EXPIRES_IN_SECONDS,
      contentType: input.contentType,
      contentLength: input.sizeBytes,
    })

    return { uploadId: upload.id, objectKey, uploadUrl, expiresAt }
  }
}

export type LinkAttachmentUploadsInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly channel: ConversationChannel
  readonly messageId: string
  readonly uploadIds: readonly string[]
}

export type LinkAttachmentUploadsDeps = {
  readonly attachments: AttachmentRepositoryPort
  readonly objectStorage: ObjectStoragePort | undefined
  readonly clock: ClockPort
}

export class LinkAttachmentUploadsUseCase {
  constructor(private readonly deps: LinkAttachmentUploadsDeps) {}

  async execute(input: LinkAttachmentUploadsInput): Promise<ConversationAttachmentRow[]> {
    const objectStorage = this.deps.objectStorage
    if (!objectStorage) throw new AttachmentsDisabledError()

    const capability = getChannelCapabilities(input.channel).attachments
    const now = this.deps.clock.now()
    let totalBytes = 0
    const results: ConversationAttachmentRow[] = []

    for (const uploadId of input.uploadIds) {
      const upload = await this.assertPendingUpload(uploadId, input)
      if (upload.expiresAt.getTime() <= now.getTime()) throw new UploadExpiredError(upload.objectKey)

      const bytes = await readAllBytes(await objectStorage.get({ bucket: upload.bucket, key: upload.objectKey }))

      const kind = attachmentKindOf(upload.declaredContentType)
      if (!kind || !matchesAttachmentSignature(upload.declaredContentType, bytes)) {
        throw new AttachmentTypeMismatchError(upload.declaredContentType, undefined)
      }
      if (bytes.byteLength > capability.maxBytes)
        throw new AttachmentTooLargeError(bytes.byteLength, capability.maxBytes)
      totalBytes += bytes.byteLength
      if (capability.maxTotalBytes !== null && totalBytes > capability.maxTotalBytes) {
        throw new AttachmentTooLargeError(totalBytes, capability.maxTotalBytes)
      }

      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const finalKey = newObjectKey()
      await objectStorage.put({
        bucket: upload.bucket,
        key: finalKey,
        body: bytes,
        contentType: upload.declaredContentType,
        sha256,
      })
      await objectStorage.delete({ bucket: upload.bucket, key: upload.objectKey })

      const attachment = await this.deps.attachments.create({
        companyId: input.companyId,
        messageId: input.messageId,
        bucket: upload.bucket,
        objectKey: finalKey,
        sha256,
        sizeBytes: bytes.byteLength,
        contentType: upload.declaredContentType,
        kind,
        fileName: upload.fileName,
      })
      await this.deps.attachments.markUploadAttached({ companyId: input.companyId, id: upload.id, attachedAt: now })
      results.push(attachment)
    }

    return results
  }

  private async assertPendingUpload(
    uploadId: string,
    input: LinkAttachmentUploadsInput,
  ): Promise<ConversationUploadRow> {
    const upload = await this.deps.attachments.findUploadById({ companyId: input.companyId, id: uploadId })
    if (!upload || upload.status !== 'pending' || upload.conversationId !== input.conversationId) {
      throw new UploadNotFoundError(uploadId)
    }
    return upload
  }
}

export type CreateAttachmentDownloadUrlInput = {
  readonly companyId: string
  readonly attachmentId: string
}

export type CreateAttachmentDownloadUrlResult = {
  readonly url: URL
}

export type CreateAttachmentDownloadUrlDeps = {
  readonly attachments: AttachmentRepositoryPort
  readonly objectStorage: ObjectStoragePort | undefined
}

export class CreateAttachmentDownloadUrlUseCase {
  constructor(private readonly deps: CreateAttachmentDownloadUrlDeps) {}

  async execute(input: CreateAttachmentDownloadUrlInput): Promise<CreateAttachmentDownloadUrlResult> {
    if (!this.deps.objectStorage) throw new AttachmentsDisabledError()

    const attachment = await this.deps.attachments.findById({ companyId: input.companyId, id: input.attachmentId })
    if (!attachment) throw new AttachmentNotFoundError(input.attachmentId)

    const url = await this.deps.objectStorage.createSignedDownload({
      bucket: attachment.bucket,
      key: attachment.objectKey,
      expiresInSeconds: ATTACHMENT_DOWNLOAD_EXPIRES_IN_SECONDS,
      disposition: 'attachment',
      fileName: attachment.fileName,
    })
    return { url }
  }
}
