/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF6/T204: um tipo de porta por agregado, para os casos de uso (T205/T206) dependerem só da
 * assinatura — nunca de Drizzle nem do `db` do host. Cada porta implementa `toda consulta com
 * company_id` por construção (`security.md` §5, "Autorização é verificada por objeto"): não há
 * método que aceite um id sem o par `(companyId, id)`.
 */
import type {
  ConversationAttachmentRow,
  ConversationMessageRow,
  ConversationParticipantRow,
  ConversationQuickReplyRow,
  ConversationReadRow,
  ConversationRow,
  ConversationUnassignedRow,
  ConversationUploadRow,
  MessageStatus,
  NewConversationAttachmentRow,
  NewConversationMessageRow,
  NewConversationParticipantRow,
  NewConversationQuickReplyRow,
  NewConversationReadRow,
  NewConversationRow,
  NewConversationUnassignedRow,
  NewConversationUploadRow,
} from '../schema/schema'

export type FindConversationBySubjectParams = {
  readonly companyId: string
  readonly subjectType: string
  readonly subjectId: string
  readonly audience: string | null
}

export type FindOpenConversationByParticipantParams = {
  readonly companyId: string
  readonly channel: string
  readonly identifier: string
}

export type FindParticipantParams = {
  readonly companyId: string
  readonly conversationId: string
  readonly channel: string
  readonly identifier: string
}

/** Conversas e participantes: o mesmo agregado, porque um participante não existe sem a conversa. */
export type ConversationRepositoryPort = {
  create(values: NewConversationRow): Promise<ConversationRow>
  findById(params: { companyId: string; id: string }): Promise<ConversationRow | undefined>
  /** Idempotência da conversa **com** assunto (CA02): `(empresa, subject_type, subject_id, audience)`. */
  findBySubject(params: FindConversationBySubjectParams): Promise<ConversationRow | undefined>
  /**
   * Idempotência da conversa **sem** assunto (CA02): a conversa aberta do mesmo participante
   * `(canal, identificador)` — nunca a mais recente entre várias, porque sem assunto só existe
   * uma aberta por participante por construção deste método (RF6, D7 "nunca palpite").
   */
  findOpenByParticipant(params: FindOpenConversationByParticipantParams): Promise<ConversationRow | undefined>
  addParticipant(values: NewConversationParticipantRow): Promise<ConversationParticipantRow>
  findParticipant(params: FindParticipantParams): Promise<ConversationParticipantRow | undefined>
}

export type FindMessageByProviderIdParams = {
  readonly companyId: string
  readonly channel: string
  readonly providerMessageId: string
}

export type UpdateMessageStatusParams = {
  readonly companyId: string
  readonly id: string
  readonly status: MessageStatus
  readonly statusTimes: Readonly<Record<string, string>>
  /** Gravado junto quando o envio acaba de devolver o id do provedor (T206, `SendMessageUseCase`). */
  readonly providerMessageId?: string
}

export type ListConversationMessagesParams = {
  readonly companyId: string
  readonly conversationId: string
  readonly cursor?: string
  readonly perPage: number
}

export type ListConversationMessagesPage = {
  readonly rows: ConversationMessageRow[]
  readonly nextCursor?: string
}

/** Mensagens e o status de entrega delas — a mesma tabela (`schema.ts`). */
export type MessageRepositoryPort = {
  create(values: NewConversationMessageRow): Promise<ConversationMessageRow>
  findById(params: { companyId: string; id: string }): Promise<ConversationMessageRow | undefined>
  /** Idempotência do status (D6): `(empresa, canal, id do provedor)`. */
  findByProviderMessageId(params: FindMessageByProviderIdParams): Promise<ConversationMessageRow | undefined>
  updateStatus(params: UpdateMessageStatusParams): Promise<ConversationMessageRow | undefined>
  list(params: ListConversationMessagesParams): Promise<ListConversationMessagesPage>
}

/** Anexos e o upload em dois passos deles — o mesmo agregado (RF8, T209/T210). */
export type AttachmentRepositoryPort = {
  create(values: NewConversationAttachmentRow): Promise<ConversationAttachmentRow>
  findById(params: { companyId: string; id: string }): Promise<ConversationAttachmentRow | undefined>
  listByMessage(params: { companyId: string; messageId: string }): Promise<ConversationAttachmentRow[]>
  createUpload(values: NewConversationUploadRow): Promise<ConversationUploadRow>
  findUploadByObjectKey(params: { companyId: string; objectKey: string }): Promise<ConversationUploadRow | undefined>
  findUploadById(params: { companyId: string; id: string }): Promise<ConversationUploadRow | undefined>
  markUploadAttached(params: {
    companyId: string
    id: string
    attachedAt: Date
  }): Promise<ConversationUploadRow | undefined>
}

export type UpsertConversationReadParams = {
  readonly companyId: string
  readonly conversationId: string
  readonly userId: string
  readonly lastReadMessageId: string
  readonly readAt: Date
}

export type ReadRepositoryPort = {
  /** Só avança (RF6): marcar lido nunca retrocede a mensagem já registrada como última lida. */
  upsert(params: UpsertConversationReadParams): Promise<ConversationReadRow>
  find(params: { companyId: string; conversationId: string; userId: string }): Promise<ConversationReadRow | undefined>
}

export type FindUnassignedByProviderIdParams = {
  readonly companyId: string
  readonly channel: string
  readonly providerMessageId: string
}

export type ListOpenUnassignedParams = {
  readonly companyId: string
  readonly channel: string
  readonly senderAddress: string
}

export type AssignUnassignedParams = {
  readonly companyId: string
  readonly id: string
  readonly assignedMessageId: string
  readonly assignedByUserId: string
  readonly assignedAt: Date
}

/** A fila de recebidas sem conversa candidata única (RF7, D7). */
export type UnassignedRepositoryPort = {
  create(values: NewConversationUnassignedRow): Promise<ConversationUnassignedRow>
  findById(params: { companyId: string; id: string }): Promise<ConversationUnassignedRow | undefined>
  findByProviderMessageId(params: FindUnassignedByProviderIdParams): Promise<ConversationUnassignedRow | undefined>
  /** Candidatas à atribuição manual: só as ainda não atribuídas, do mesmo remetente. */
  listOpenBySender(params: ListOpenUnassignedParams): Promise<ConversationUnassignedRow[]>
  assign(params: AssignUnassignedParams): Promise<ConversationUnassignedRow | undefined>
}

/** Respostas rápidas por público (RF9) — CRUD simples, sem regra própria neste pacote. */
export type QuickReplyRepositoryPort = {
  create(values: NewConversationQuickReplyRow): Promise<ConversationQuickReplyRow>
  listByAudience(params: { companyId: string; audience: string }): Promise<ConversationQuickReplyRow[]>
  findById(params: { companyId: string; id: string }): Promise<ConversationQuickReplyRow | undefined>
  update(params: {
    companyId: string
    id: string
    bodyText?: string
    position?: number
    active?: boolean
  }): Promise<ConversationQuickReplyRow | undefined>
}
