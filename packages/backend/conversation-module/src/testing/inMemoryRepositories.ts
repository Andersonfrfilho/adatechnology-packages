/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória que satisfazem as portas de `repositories/ports.ts` — a suíte de
 * comportamento dos casos de uso (T205 em diante) roda sem Postgres. Exportado em
 * `@adatechnology/conversation-module/testing`, no molde de `notification-module/testing`.
 */
import { randomUUID } from 'node:crypto'

import type {
  CreateSignedConversationDownloadUrlInput,
  CreateSignedConversationUploadUrlInput,
  ObjectStoragePort,
} from '@adatechnology/conversation-contracts'

import type {
  ConversationAttachmentRow,
  ConversationMessageRow,
  ConversationParticipantRow,
  ConversationQuickReplyRow,
  ConversationReadRow,
  ConversationRow,
  ConversationUnassignedRow,
  ConversationUploadRow,
  NewConversationAttachmentRow,
  NewConversationMessageRow,
  NewConversationParticipantRow,
  NewConversationQuickReplyRow,
  NewConversationRow,
  NewConversationUnassignedRow,
  NewConversationUploadRow,
} from '../schema/schema'
import type {
  AssignUnassignedParams,
  AttachmentRepositoryPort,
  ConversationRepositoryPort,
  FindConversationBySubjectParams,
  FindMessageByProviderIdParams,
  FindOpenConversationByParticipantParams,
  FindParticipantParams,
  FindUnassignedByProviderIdParams,
  ListConversationMessagesPage,
  ListConversationMessagesParams,
  ListOpenUnassignedParams,
  MessageRepositoryPort,
  QuickReplyRepositoryPort,
  ReadRepositoryPort,
  UnassignedRepositoryPort,
  UpdateMessageStatusParams,
  UpsertConversationReadParams,
} from '../repositories/ports'

const EPOCH = new Date('2026-09-01T12:00:00.000Z')

export type InMemoryConversationRepository = ConversationRepositoryPort & {
  readonly rows: ConversationRow[]
  readonly participantRows: ConversationParticipantRow[]
}

export function createInMemoryConversations(seed: ConversationRow[] = []): InMemoryConversationRepository {
  const rows: ConversationRow[] = [...seed]
  const participantRows: ConversationParticipantRow[] = []

  return {
    rows,
    participantRows,
    async create(values: NewConversationRow) {
      const row = {
        id: randomUUID(),
        subjectType: null,
        subjectId: null,
        audience: null,
        publicRef: null,
        status: 'open',
        defaultChannel: null,
        windowNoticeSentFor: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as ConversationRow
      rows.push(row)
      return row
    },
    async findById(params) {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async findBySubject(params: FindConversationBySubjectParams) {
      return rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.subjectType === params.subjectType &&
          row.subjectId === params.subjectId &&
          (row.audience ?? null) === params.audience,
      )
    },
    async findOpenByParticipant(params: FindOpenConversationByParticipantParams) {
      const candidate = participantRows.find(
        (participant) =>
          participant.companyId === params.companyId &&
          participant.channel === params.channel &&
          participant.identifier === params.identifier,
      )
      if (!candidate) return undefined
      return rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.id === candidate.conversationId &&
          row.subjectType === null &&
          row.status === 'open',
      )
    },
    async listOpenByParticipant(params: FindOpenConversationByParticipantParams) {
      const candidateConversationIds = new Set(
        participantRows
          .filter(
            (participant) =>
              participant.companyId === params.companyId &&
              participant.channel === params.channel &&
              participant.identifier === params.identifier,
          )
          .map((participant) => participant.conversationId),
      )
      return rows.filter(
        (row) => row.companyId === params.companyId && row.status === 'open' && candidateConversationIds.has(row.id),
      )
    },
    async addParticipant(values: NewConversationParticipantRow) {
      const existing = participantRows.find(
        (participant) =>
          participant.companyId === values.companyId &&
          participant.conversationId === values.conversationId &&
          participant.channel === values.channel &&
          participant.identifier === values.identifier,
      )
      if (existing) return existing
      const row = {
        id: randomUUID(),
        createdAt: EPOCH,
        ...values,
      } as ConversationParticipantRow
      participantRows.push(row)
      return row
    },
    async findParticipant(params: FindParticipantParams) {
      return participantRows.find(
        (participant) =>
          participant.companyId === params.companyId &&
          participant.conversationId === params.conversationId &&
          participant.channel === params.channel &&
          participant.identifier === params.identifier,
      )
    },
  }
}

export type InMemoryMessageRepository = MessageRepositoryPort & { readonly rows: ConversationMessageRow[] }

export function createInMemoryMessages(seed: ConversationMessageRow[] = []): InMemoryMessageRepository {
  const rows: ConversationMessageRow[] = [...seed]

  return {
    rows,
    async create(values: NewConversationMessageRow) {
      const row = {
        id: randomUUID(),
        authorUserId: null,
        automatic: false,
        senderAddress: null,
        bodyText: '',
        status: null,
        statusTimes: {},
        providerMessageId: null,
        transportRef: null,
        dkimResult: null,
        createdAt: EPOCH,
        ...values,
      } as ConversationMessageRow
      rows.push(row)
      return row
    },
    async findById(params) {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async findByProviderMessageId(params: FindMessageByProviderIdParams) {
      return rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.channel === params.channel &&
          row.providerMessageId === params.providerMessageId,
      )
    },
    async updateStatus(params: UpdateMessageStatusParams) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      row.status = params.status
      row.statusTimes = { ...params.statusTimes }
      if (params.providerMessageId !== undefined) row.providerMessageId = params.providerMessageId
      return row
    },
    async list(params: ListConversationMessagesParams): Promise<ListConversationMessagesPage> {
      const matches = rows
        .filter((row) => row.companyId === params.companyId && row.conversationId === params.conversationId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      const page = matches.slice(0, params.perPage)
      return { rows: page }
    },
  }
}

export type InMemoryAttachmentRepository = AttachmentRepositoryPort & {
  readonly rows: ConversationAttachmentRow[]
  readonly uploadRows: ConversationUploadRow[]
}

export function createInMemoryAttachments(): InMemoryAttachmentRepository {
  const rows: ConversationAttachmentRow[] = []
  const uploadRows: ConversationUploadRow[] = []

  return {
    rows,
    uploadRows,
    async create(values: NewConversationAttachmentRow) {
      const row = {
        id: randomUUID(),
        fileName: '',
        durationMs: null,
        transcriptText: null,
        createdAt: EPOCH,
        ...values,
      } as ConversationAttachmentRow
      rows.push(row)
      return row
    },
    async findById(params) {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async listByMessage(params) {
      return rows.filter((row) => row.companyId === params.companyId && row.messageId === params.messageId)
    },
    async createUpload(values: NewConversationUploadRow) {
      const row = {
        id: randomUUID(),
        fileName: '',
        status: 'pending',
        attachedAt: null,
        createdAt: EPOCH,
        ...values,
      } as ConversationUploadRow
      uploadRows.push(row)
      return row
    },
    async findUploadByObjectKey(params) {
      return uploadRows.find((row) => row.companyId === params.companyId && row.objectKey === params.objectKey)
    },
    async findUploadById(params) {
      return uploadRows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async markUploadAttached(params) {
      const row = uploadRows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      row.status = 'attached'
      row.attachedAt = params.attachedAt
      return row
    },
  }
}

export type InMemoryReadRepository = ReadRepositoryPort & { readonly rows: ConversationReadRow[] }

export function createInMemoryReads(): InMemoryReadRepository {
  const rows: ConversationReadRow[] = []

  return {
    rows,
    async upsert(params: UpsertConversationReadParams) {
      const existing = rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.conversationId === params.conversationId &&
          row.userId === params.userId,
      )
      if (existing) {
        existing.lastReadMessageId = params.lastReadMessageId
        existing.readAt = params.readAt
        return existing
      }
      const row = {
        id: randomUUID(),
        companyId: params.companyId,
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId: params.lastReadMessageId,
        readAt: params.readAt,
      } as ConversationReadRow
      rows.push(row)
      return row
    },
    async find(params) {
      return rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.conversationId === params.conversationId &&
          row.userId === params.userId,
      )
    },
  }
}

export type InMemoryUnassignedRepository = UnassignedRepositoryPort & { readonly rows: ConversationUnassignedRow[] }

export function createInMemoryUnassigned(): InMemoryUnassignedRepository {
  const rows: ConversationUnassignedRow[] = []

  return {
    rows,
    async create(values: NewConversationUnassignedRow) {
      const row = {
        id: randomUUID(),
        bodyText: '',
        providerMessageId: null,
        transportRef: null,
        dkimResult: null,
        assignedMessageId: null,
        assignedAt: null,
        assignedByUserId: null,
        createdAt: EPOCH,
        ...values,
      } as ConversationUnassignedRow
      rows.push(row)
      return row
    },
    async findById(params) {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async findByProviderMessageId(params: FindUnassignedByProviderIdParams) {
      return rows.find(
        (row) =>
          row.companyId === params.companyId &&
          row.channel === params.channel &&
          row.providerMessageId === params.providerMessageId,
      )
    },
    async listOpenBySender(params: ListOpenUnassignedParams) {
      return rows.filter(
        (row) =>
          row.companyId === params.companyId &&
          row.channel === params.channel &&
          row.senderAddress === params.senderAddress &&
          row.assignedMessageId === null,
      )
    },
    async assign(params: AssignUnassignedParams) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      row.assignedMessageId = params.assignedMessageId
      row.assignedByUserId = params.assignedByUserId
      row.assignedAt = params.assignedAt
      return row
    },
  }
}

export type InMemoryQuickReplyRepository = QuickReplyRepositoryPort & { readonly rows: ConversationQuickReplyRow[] }

export function createInMemoryQuickReplies(): InMemoryQuickReplyRepository {
  const rows: ConversationQuickReplyRow[] = []

  return {
    rows,
    async create(values: NewConversationQuickReplyRow) {
      const row = {
        id: randomUUID(),
        active: true,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as ConversationQuickReplyRow
      rows.push(row)
      return row
    },
    async listByAudience(params) {
      return rows
        .filter((row) => row.companyId === params.companyId && row.audience === params.audience)
        .sort((a, b) => a.position - b.position)
    },
    async listByCompany(params) {
      return rows.filter((row) => row.companyId === params.companyId).sort((a, b) => a.position - b.position)
    },
    async findById(params) {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async update(params) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      if (params.bodyText !== undefined) row.bodyText = params.bodyText
      if (params.position !== undefined) row.position = params.position
      if (params.active !== undefined) row.active = params.active
      row.updatedAt = EPOCH
      return row
    },
  }
}

export function createFixedClock(now: Date): { now(): Date } {
  return { now: () => now }
}

export type InMemoryObjectStorage = ObjectStoragePort & {
  readonly objects: Map<string, { bytes: Uint8Array; contentType: string }>
  /** O que cada assinatura recebeu — é o que prova que a URL amarra tipo e tamanho declarados. */
  readonly signedUploads: CreateSignedConversationUploadUrlInput[]
  readonly signedDownloads: CreateSignedConversationDownloadUrlInput[]
}

/** Dublê do `ObjectStoragePort` (T209/T210): guarda os bytes em memória, chaveados por `bucket/key`. */
export function createInMemoryObjectStorage(): InMemoryObjectStorage {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>()
  const signedUploads: CreateSignedConversationUploadUrlInput[] = []
  const signedDownloads: CreateSignedConversationDownloadUrlInput[] = []
  const keyOf = (location: { bucket: string; key: string }): string => `${location.bucket}/${location.key}`

  return {
    objects,
    async put(input) {
      objects.set(keyOf(input), { bytes: input.body, contentType: input.contentType })
    },
    async get(input) {
      const object = objects.get(keyOf(input))
      if (!object) throw new Error(`conversation-module/testing: objeto ausente em ${keyOf(input)}`)
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(object.bytes)
          controller.close()
        },
      })
    },
    async delete(input) {
      objects.delete(keyOf(input))
    },
    async createSignedDownload(input) {
      signedDownloads.push(input)
      return new URL(`https://storage.test/${keyOf(input)}?mode=download`)
    },
    async createSignedUpload(input) {
      signedUploads.push(input)
      return new URL(`https://storage.test/${keyOf(input)}?mode=upload`)
    },
    signedUploads,
    signedDownloads,
  }
}
