/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { advanceDeliveryStatus } from '@adatechnology/conversation-contracts'
import type {
  ClockPort,
  ConversationChannel,
  ConversationChannelPort,
  MessageDeliveryStatus,
} from '@adatechnology/conversation-contracts'

import { ChannelPortNotConfiguredError } from '../errors'
import type { ConversationMessageRow } from '../schema/schema'
import type { ListConversationMessagesPage, MessageRepositoryPort } from '../repositories/ports'

export type SendMessageInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly channel: ConversationChannel
  /** Endereço/identificador do destinatário no canal — opaco, repassado à porta. */
  readonly to: string
  readonly bodyText: string
  /** Ausente ou `automatic: true`: mensagem sem autor humano. */
  readonly authorUserId?: string
  readonly automatic?: boolean
}

export type SendMessageDeps = {
  readonly messages: MessageRepositoryPort
  readonly channels: Partial<Record<ConversationChannel, ConversationChannelPort>>
  readonly clock: ClockPort
}

/** RF6: grava `queued`, chama a porta do canal, grava o id do provedor. Canal sem porta é erro. */
export class SendMessageUseCase {
  constructor(private readonly deps: SendMessageDeps) {}

  async execute(input: SendMessageInput): Promise<ConversationMessageRow> {
    const port = this.deps.channels[input.channel]
    if (!port) throw new ChannelPortNotConfiguredError(input.channel)

    const automatic = input.automatic ?? false
    const now = this.deps.clock.now().toISOString()

    const message = await this.deps.messages.create({
      companyId: input.companyId,
      conversationId: input.conversationId,
      channel: input.channel,
      direction: 'outbound',
      automatic,
      authorUserId: automatic ? null : (input.authorUserId ?? null),
      bodyText: input.bodyText,
      status: 'queued',
      statusTimes: { queued: now },
    })

    const result = await port.sendText({
      channel: input.channel,
      to: input.to,
      messageId: message.id,
      bodyText: input.bodyText,
    })

    const updated = await this.deps.messages.updateStatus({
      companyId: input.companyId,
      id: message.id,
      status: 'queued',
      statusTimes: message.statusTimes,
      providerMessageId: result.providerMessageId,
    })

    return updated ?? { ...message, providerMessageId: result.providerMessageId }
  }
}

export type ReceiveMessageInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly channel: ConversationChannel
  readonly bodyText: string
  /** Canal externo (email/whatsapp/webchat): o endereço que mandou. */
  readonly senderAddress?: string
  /** Canal com conta do host (app/portal/webchat): quem mandou. */
  readonly authorUserId?: string
  readonly providerMessageId?: string
  readonly transportRef?: string
  readonly dkimResult?: string
}

export type ReceiveMessageDeps = {
  readonly messages: MessageRepositoryPort
}

/** RF6: inbound com `sender_address` (canal externo) ou `author_user_id` (canal com conta do host). */
export class ReceiveMessageUseCase {
  constructor(private readonly deps: ReceiveMessageDeps) {}

  async execute(input: ReceiveMessageInput): Promise<ConversationMessageRow> {
    return this.deps.messages.create({
      companyId: input.companyId,
      conversationId: input.conversationId,
      channel: input.channel,
      direction: 'inbound',
      automatic: false,
      authorUserId: input.authorUserId ?? null,
      senderAddress: input.senderAddress ?? null,
      bodyText: input.bodyText,
      providerMessageId: input.providerMessageId ?? null,
      transportRef: input.transportRef ?? null,
      dkimResult: input.dkimResult ?? null,
      status: null,
      statusTimes: {},
    })
  }
}

export type UpdateMessageStatusInput = {
  readonly companyId: string
  readonly channel: ConversationChannel
  readonly providerMessageId: string
  readonly status: MessageDeliveryStatus
  /** Horário ISO da transição, informado por quem chama (webhook do provedor). */
  readonly at: string
}

export type UpdateMessageStatusDeps = {
  readonly messages: MessageRepositoryPort
}

/**
 * D6/CA05: idempotente por `(canal, id do provedor)` — a busca já resolve isso; a mudança de
 * status em si usa `advanceDeliveryStatus` do contracts (RF3). Id de provedor desconhecido é
 * **ignorado sem erro** — devolve `undefined`, nunca lança.
 */
export class UpdateMessageStatusUseCase {
  constructor(private readonly deps: UpdateMessageStatusDeps) {}

  async execute(input: UpdateMessageStatusInput): Promise<ConversationMessageRow | undefined> {
    const message = await this.deps.messages.findByProviderMessageId({
      companyId: input.companyId,
      channel: input.channel,
      providerMessageId: input.providerMessageId,
    })
    if (!message || message.status === null) return message ?? undefined

    const result = advanceDeliveryStatus({
      channel: input.channel,
      current: { status: message.status, statusTimes: message.statusTimes },
      event: { status: input.status, at: input.at },
    })
    if (!result.changed) return message

    return this.deps.messages.updateStatus({
      companyId: input.companyId,
      id: message.id,
      status: result.status,
      statusTimes: result.statusTimes,
    })
  }
}

export type ListConversationMessagesInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly cursor?: string
  readonly perPage: number
}

export type ListConversationMessagesDeps = {
  readonly messages: MessageRepositoryPort
}

export class ListConversationMessagesUseCase {
  constructor(private readonly deps: ListConversationMessagesDeps) {}

  async execute(input: ListConversationMessagesInput): Promise<ListConversationMessagesPage> {
    return this.deps.messages.list(input)
  }
}
