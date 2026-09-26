/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF7, D7, CA06: atribuição genérica de mensagem recebida por canal externo, portada de
 * `whatsapp-attribution.policy.ts` (spec 183) — a **regra**, não o vocabulário (nada de
 * `contractorId`/`driverUserId` aqui; a regra de "quem pode ver essa conversa" que a origem
 * resolvia com `optedInContractorIds` vira `filterCandidates`, porta opcional do host).
 */
import type { ClockPort, ConversationChannel } from '@adatechnology/conversation-contracts'

import type { ConversationMessageRow, ConversationRow, ConversationUnassignedRow } from '../schema/schema'
import type { ConversationRepositoryPort, MessageRepositoryPort, UnassignedRepositoryPort } from '../repositories/ports'
import { ConversationNotFoundError, UnassignedNotFoundError } from '../errors'
import type { FilterConversationCandidatesPort } from './Attribution.types'

export type AttributeInboundMessageInput = {
  readonly companyId: string
  readonly channel: ConversationChannel
  readonly identifier: string
  readonly bodyText: string
  readonly providerMessageId?: string
  readonly transportRef?: string
  readonly dkimResult?: string
  /** Conversa já resolvida pelo transporte do host (token do e-mail, contexto do WhatsApp → id do provedor). */
  readonly replyConversationId?: string
}

export type AttributeInboundMessageResult =
  | { readonly kind: 'attached'; readonly conversationId: string; readonly message: ConversationMessageRow }
  | { readonly kind: 'unassigned'; readonly entry: ConversationUnassignedRow }
  | { readonly kind: 'no_candidate' }

export type AttributeInboundMessageDeps = {
  readonly conversations: ConversationRepositoryPort
  readonly messages: MessageRepositoryPort
  readonly unassigned: UnassignedRepositoryPort
  readonly clock: ClockPort
  /** Ausente: todas as conversas abertas do participante contam como candidatas. */
  readonly filterCandidates?: FilterConversationCandidatesPort
}

export class AttributeInboundMessageUseCase {
  constructor(private readonly deps: AttributeInboundMessageDeps) {}

  async execute(input: AttributeInboundMessageInput): Promise<AttributeInboundMessageResult> {
    const idempotent = await this.findIdempotent(input)
    if (idempotent) return idempotent

    if (input.replyConversationId) {
      const conversation = await this.deps.conversations.findById({
        companyId: input.companyId,
        id: input.replyConversationId,
      })
      if (conversation) {
        const message = await this.receiveInto(input, conversation)
        return { kind: 'attached', conversationId: conversation.id, message }
      }
      // Referência inválida ou de outra empresa: nunca aceita cega — cai no fluxo por candidatas.
    }

    const allCandidates = await this.deps.conversations.listOpenByParticipant({
      companyId: input.companyId,
      channel: input.channel,
      identifier: input.identifier,
    })
    const candidates = this.deps.filterCandidates
      ? await this.deps.filterCandidates.filter({
          companyId: input.companyId,
          channel: input.channel,
          identifier: input.identifier,
          candidates: allCandidates,
        })
      : allCandidates

    const [single] = candidates
    if (candidates.length === 1 && single) {
      const message = await this.receiveInto(input, single)
      return { kind: 'attached', conversationId: single.id, message }
    }
    if (candidates.length > 1) {
      const entry = await this.deps.unassigned.create({
        companyId: input.companyId,
        channel: input.channel,
        senderAddress: input.identifier,
        bodyText: input.bodyText,
        providerMessageId: input.providerMessageId ?? null,
        transportRef: input.transportRef ?? null,
        dkimResult: input.dkimResult ?? null,
        receivedAt: this.deps.clock.now(),
      })
      return { kind: 'unassigned', entry }
    }
    // Nenhuma candidata: nada é gravado — o host decide (ex.: recusar, ou seguir outro fluxo).
    return { kind: 'no_candidate' }
  }

  private async findIdempotent(
    input: AttributeInboundMessageInput,
  ): Promise<AttributeInboundMessageResult | undefined> {
    if (!input.providerMessageId) return undefined
    const existingMessage = await this.deps.messages.findByProviderMessageId({
      companyId: input.companyId,
      channel: input.channel,
      providerMessageId: input.providerMessageId,
    })
    if (existingMessage)
      return { kind: 'attached', conversationId: existingMessage.conversationId, message: existingMessage }

    const existingUnassigned = await this.deps.unassigned.findByProviderMessageId({
      companyId: input.companyId,
      channel: input.channel,
      providerMessageId: input.providerMessageId,
    })
    if (existingUnassigned) return { kind: 'unassigned', entry: existingUnassigned }

    return undefined
  }

  private async receiveInto(
    input: AttributeInboundMessageInput,
    conversation: ConversationRow,
  ): Promise<ConversationMessageRow> {
    return this.deps.messages.create({
      companyId: input.companyId,
      conversationId: conversation.id,
      channel: input.channel,
      direction: 'inbound',
      automatic: false,
      senderAddress: input.identifier,
      bodyText: input.bodyText,
      providerMessageId: input.providerMessageId ?? null,
      transportRef: input.transportRef ?? null,
      dkimResult: input.dkimResult ?? null,
      status: null,
      statusTimes: {},
    })
  }
}

export type AssignUnassignedToConversationInput = {
  readonly companyId: string
  readonly unassignedId: string
  readonly conversationId: string
  readonly assignedByUserId: string
}

export type AssignUnassignedToConversationResult = {
  readonly entry: ConversationUnassignedRow
  readonly message: ConversationMessageRow
}

export type AssignUnassignedToConversationDeps = {
  readonly conversations: ConversationRepositoryPort
  readonly messages: MessageRepositoryPort
  readonly unassigned: UnassignedRepositoryPort
  readonly clock: ClockPort
}

/** RF7: atribuição manual de um item da fila — mensagem e `assigned_*` gravados juntos. */
export class AssignUnassignedToConversationUseCase {
  constructor(private readonly deps: AssignUnassignedToConversationDeps) {}

  async execute(input: AssignUnassignedToConversationInput): Promise<AssignUnassignedToConversationResult> {
    const entry = await this.deps.unassigned.findById({ companyId: input.companyId, id: input.unassignedId })
    if (!entry) throw new UnassignedNotFoundError(input.unassignedId)

    const conversation = await this.deps.conversations.findById({
      companyId: input.companyId,
      id: input.conversationId,
    })
    if (!conversation) throw new ConversationNotFoundError(input.conversationId)

    const message = await this.deps.messages.create({
      companyId: input.companyId,
      conversationId: conversation.id,
      channel: entry.channel,
      direction: 'inbound',
      automatic: false,
      senderAddress: entry.senderAddress,
      bodyText: entry.bodyText,
      providerMessageId: entry.providerMessageId,
      transportRef: entry.transportRef,
      dkimResult: entry.dkimResult,
      status: null,
      statusTimes: {},
    })

    const assignedAt = this.deps.clock.now()
    const assigned = await this.deps.unassigned.assign({
      companyId: input.companyId,
      id: entry.id,
      assignedMessageId: message.id,
      assignedByUserId: input.assignedByUserId,
      assignedAt,
    })
    if (!assigned) throw new UnassignedNotFoundError(input.unassignedId)

    return { entry: assigned, message }
  }
}
