/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T209 (RF8): upload em dois passos — pedido (URL assinada curta, chave opaca de 256 bits sem id
 * interno) e ligação (confere pedido pending, conversa, prazo, teto e bytes; copia para uma chave
 * final nova, apagando a da subida). Vermelho até a T210 criar `Attachment.use-cases.ts`.
 */
import { describe, expect, it } from 'bun:test'

import {
  AttachmentsDisabledError,
  AttachmentTooLargeError,
  AttachmentTypeMismatchError,
  UploadExpiredError,
} from '../errors'
import {
  createFixedClock,
  createInMemoryAttachments,
  createInMemoryObjectStorage,
} from '../testing/inMemoryRepositories'
import {
  CreateAttachmentDownloadUrlUseCase,
  LinkAttachmentUploadsUseCase,
  RequestAttachmentUploadUseCase,
} from './Attachment.use-cases'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222'
const MESSAGE_ID = '33333333-3333-3333-3333-333333333333'
const NOW = new Date('2026-09-26T12:00:00.000Z')
const BUCKET = 'conversation-attachments'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

describe('RequestAttachmentUploadUseCase (RF8)', () => {
  it('pede a URL assinada com chave opaca, sem id interno', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const useCase = new RequestAttachmentUploadUseCase({
      attachments,
      objectStorage,
      clock: createFixedClock(NOW),
      bucket: BUCKET,
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'email',
      requestedByUserId: 'user-1',
      contentType: 'image/png',
      fileName: 'foto.png',
      sizeBytes: PNG_BYTES.byteLength,
    })

    expect(result.uploadUrl).toBeInstanceOf(URL)
    /**
     * A URL assinada amarra **o que vai subir**: o tipo e o tamanho daquele pedido, não um teto do
     * bucket. Sem isso, quem tem a URL sobe qualquer coisa até ela expirar — a conferência de bytes
     * na ligação recusaria o anexo depois, mas o objeto já teria entrado no bucket.
     */
    expect(objectStorage.signedUploads).toHaveLength(1)
    expect(objectStorage.signedUploads[0]?.contentType).toBe('image/png')
    expect(objectStorage.signedUploads[0]?.contentLength).toBe(PNG_BYTES.byteLength)
    expect(objectStorage.signedUploads[0]?.key).toBe(result.objectKey)
    expect(result.objectKey).not.toContain(CONVERSATION_ID)
    expect(result.objectKey).not.toContain('user-1')
    expect(attachments.uploadRows).toHaveLength(1)
    expect(attachments.uploadRows[0]?.status).toBe('pending')
  })

  it('recusa content-type fora do vocabulário fechado', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const useCase = new RequestAttachmentUploadUseCase({
      attachments,
      objectStorage,
      clock: createFixedClock(NOW),
      bucket: BUCKET,
    })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'email',
        requestedByUserId: 'user-1',
        contentType: 'image/svg+xml',
        fileName: 'malicioso.svg',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(AttachmentTypeMismatchError)
  })

  it('recusa tamanho declarado acima do teto do canal (CHANNEL_CAPABILITIES)', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const useCase = new RequestAttachmentUploadUseCase({
      attachments,
      objectStorage,
      clock: createFixedClock(NOW),
      bucket: BUCKET,
    })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'webchat',
        requestedByUserId: 'user-1',
        contentType: 'image/png',
        fileName: 'grande.png',
        sizeBytes: 50 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(AttachmentTooLargeError)
  })

  it('sem objectStorage, anexo desligado com erro claro', async () => {
    const attachments = createInMemoryAttachments()
    const useCase = new RequestAttachmentUploadUseCase({
      attachments,
      objectStorage: undefined,
      clock: createFixedClock(NOW),
      bucket: BUCKET,
    })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'email',
        requestedByUserId: 'user-1',
        contentType: 'image/png',
        fileName: 'foto.png',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(AttachmentsDisabledError)
  })
})

describe('LinkAttachmentUploadsUseCase (RF8)', () => {
  async function createPendingUpload(
    attachments: ReturnType<typeof createInMemoryAttachments>,
    objectStorage: ReturnType<typeof createInMemoryObjectStorage>,
    overrides: Partial<{ expiresAt: Date; declaredContentType: string }> = {},
  ) {
    const upload = await attachments.createUpload({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'email',
      requestedByUserId: 'user-1',
      bucket: BUCKET,
      objectKey: `conversation-uploads/${crypto.randomUUID()}`,
      declaredContentType: overrides.declaredContentType ?? 'image/png',
      declaredSizeBytes: PNG_BYTES.byteLength,
      fileName: 'foto.png',
      expiresAt: overrides.expiresAt ?? new Date(NOW.getTime() + 60_000),
    })
    await objectStorage.put({
      bucket: BUCKET,
      key: upload.objectKey,
      body: PNG_BYTES,
      contentType: 'image/png',
      sha256: '',
    })
    return upload
  }

  it('liga o pedido pending, calcula sha256 e copia para uma chave final nova, apagando a da subida', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const upload = await createPendingUpload(attachments, objectStorage)
    const useCase = new LinkAttachmentUploadsUseCase({ attachments, objectStorage, clock: createFixedClock(NOW) })

    const [attachment] = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'email',
      messageId: MESSAGE_ID,
      uploadIds: [upload.id],
    })

    expect(attachment?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(attachment?.objectKey).not.toBe(upload.objectKey)
    expect(objectStorage.objects.has(`${BUCKET}/${upload.objectKey}`)).toBe(false)
    expect(objectStorage.objects.has(`${BUCKET}/${attachment?.objectKey}`)).toBe(true)
    const attached = await attachments.findUploadById({ companyId: COMPANY_ID, id: upload.id })
    expect(attached?.status).toBe('attached')
  })

  it('nenhum byte vai para o banco — só sha256, tamanho e chave do objeto', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const upload = await createPendingUpload(attachments, objectStorage)
    const useCase = new LinkAttachmentUploadsUseCase({ attachments, objectStorage, clock: createFixedClock(NOW) })

    const [attachment] = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'email',
      messageId: MESSAGE_ID,
      uploadIds: [upload.id],
    })

    const persistedKeys = Object.keys(attachment ?? {})
    expect(persistedKeys).not.toContain('bytes')
    expect(persistedKeys).not.toContain('body')
  })

  it('extensão/content-type mentindo (bytes não batem com o declarado) é recusado', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const upload = await createPendingUpload(attachments, objectStorage, { declaredContentType: 'application/pdf' })
    const useCase = new LinkAttachmentUploadsUseCase({ attachments, objectStorage, clock: createFixedClock(NOW) })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'email',
        messageId: MESSAGE_ID,
        uploadIds: [upload.id],
      }),
    ).rejects.toBeInstanceOf(AttachmentTypeMismatchError)
  })

  it('pedido expirado é recusado', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const upload = await createPendingUpload(attachments, objectStorage, { expiresAt: new Date(NOW.getTime() - 1000) })
    const useCase = new LinkAttachmentUploadsUseCase({ attachments, objectStorage, clock: createFixedClock(NOW) })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'email',
        messageId: MESSAGE_ID,
        uploadIds: [upload.id],
      }),
    ).rejects.toBeInstanceOf(UploadExpiredError)
  })

  it('teto por canal: bytes maiores que o teto do canal são recusados', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const upload = await attachments.createUpload({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'webchat',
      requestedByUserId: 'user-1',
      bucket: BUCKET,
      objectKey: 'conversation-uploads/grande',
      declaredContentType: 'image/png',
      declaredSizeBytes: PNG_BYTES.byteLength,
      fileName: 'foto.png',
      expiresAt: new Date(NOW.getTime() + 60_000),
    })
    const bigBytes = new Uint8Array(11 * 1024 * 1024)
    bigBytes.set(PNG_BYTES)
    await objectStorage.put({
      bucket: BUCKET,
      key: upload.objectKey,
      body: bigBytes,
      contentType: 'image/png',
      sha256: '',
    })
    const useCase = new LinkAttachmentUploadsUseCase({ attachments, objectStorage, clock: createFixedClock(NOW) })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'webchat',
        messageId: MESSAGE_ID,
        uploadIds: [upload.id],
      }),
    ).rejects.toBeInstanceOf(AttachmentTooLargeError)
  })

  it('sem objectStorage, anexo desligado com erro claro', async () => {
    const attachments = createInMemoryAttachments()
    const useCase = new LinkAttachmentUploadsUseCase({
      attachments,
      objectStorage: undefined,
      clock: createFixedClock(NOW),
    })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'email',
        messageId: MESSAGE_ID,
        uploadIds: ['algum-id'],
      }),
    ).rejects.toBeInstanceOf(AttachmentsDisabledError)
  })
})

describe('CreateAttachmentDownloadUrlUseCase (RF8)', () => {
  it('devolve URL temporária curta de leitura', async () => {
    const attachments = createInMemoryAttachments()
    const objectStorage = createInMemoryObjectStorage()
    const attachment = await attachments.create({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
      bucket: BUCKET,
      objectKey: 'conversation-attachments/final-1',
      sha256: 'a'.repeat(64),
      sizeBytes: 12,
      contentType: 'image/png',
      kind: 'image',
      fileName: 'foto.png',
    })
    const useCase = new CreateAttachmentDownloadUrlUseCase({ attachments, objectStorage })

    const result = await useCase.execute({ companyId: COMPANY_ID, attachmentId: attachment.id })

    expect(result.url).toBeInstanceOf(URL)
  })
})
