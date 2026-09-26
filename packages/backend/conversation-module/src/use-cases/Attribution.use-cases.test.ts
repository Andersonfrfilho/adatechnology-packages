/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T207 (RF7, D7, CA06): atribuição genérica de mensagem recebida por canal externo. Vermelho até a
 * T208 criar `Attribution.use-cases.ts`.
 */
import { describe, expect, it } from 'bun:test'

import {
  createFixedClock,
  createInMemoryConversations,
  createInMemoryMessages,
  createInMemoryUnassigned,
} from '../testing/inMemoryRepositories'
import { AssignUnassignedToConversationUseCase, AttributeInboundMessageUseCase } from './Attribution.use-cases'
import type { FilterConversationCandidatesPort } from './Attribution.types'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_COMPANY_ID = '99999999-9999-9999-9999-999999999999'
const NOW = new Date('2026-09-26T12:00:00.000Z')

describe('AttributeInboundMessageUseCase (RF7, D7, CA06)', () => {
  it('referência de resposta válida da mesma empresa atribui direto àquela conversa', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const conversation = await conversations.create({ companyId: COMPANY_ID })
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'cliente@example.com',
      bodyText: 'Resposta',
      replyConversationId: conversation.id,
    })

    expect(result.kind).toBe('attached')
    if (result.kind === 'attached') expect(result.conversationId).toBe(conversation.id)
  })

  it('referência de outra empresa é ignorada e cai no fluxo por candidatas', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const foreignConversation = await conversations.create({ companyId: OTHER_COMPANY_ID })
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'cliente@example.com',
      bodyText: 'Resposta',
      replyConversationId: foreignConversation.id,
    })

    expect(result.kind).toBe('no_candidate')
  })

  it('sem referência, uma única candidata aberta atribui direto', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const conversation = await conversations.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId: 'lead-1' })
    await conversations.addParticipant({
      companyId: COMPANY_ID,
      conversationId: conversation.id,
      channel: 'email',
      identifier: 'cliente@example.com',
    })
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'cliente@example.com',
      bodyText: 'Oi',
    })

    expect(result.kind).toBe('attached')
    if (result.kind === 'attached') {
      expect(result.conversationId).toBe(conversation.id)
      expect(result.message.senderAddress).toBe('cliente@example.com')
    }
  })

  it('sem referência, mais de uma candidata vai para a fila de não atribuídas — nunca palpite', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    for (const subjectId of ['lead-1', 'lead-2']) {
      const conversation = await conversations.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId })
      await conversations.addParticipant({
        companyId: COMPANY_ID,
        conversationId: conversation.id,
        channel: 'email',
        identifier: 'cliente@example.com',
      })
    }
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'cliente@example.com',
      bodyText: 'Oi',
    })

    expect(result.kind).toBe('unassigned')
    expect(unassigned.rows).toHaveLength(1)
    expect(messages.rows).toHaveLength(0)
  })

  it('sem candidata nenhuma, resultado é no_candidate e nada é gravado', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'ninguem@example.com',
      bodyText: 'Oi',
    })

    expect(result.kind).toBe('no_candidate')
    expect(messages.rows).toHaveLength(0)
    expect(unassigned.rows).toHaveLength(0)
  })

  it('filterCandidates reduz o conjunto — é onde o produto põe a regra de atribuível', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const keep = await conversations.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId: 'lead-1' })
    const drop = await conversations.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId: 'lead-2' })
    for (const conversation of [keep, drop]) {
      await conversations.addParticipant({
        companyId: COMPANY_ID,
        conversationId: conversation.id,
        channel: 'email',
        identifier: 'cliente@example.com',
      })
    }
    const filterCandidates: FilterConversationCandidatesPort = {
      async filter(input) {
        return input.candidates.filter((candidate) => candidate.id === keep.id)
      },
    }
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
      filterCandidates,
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'email',
      identifier: 'cliente@example.com',
      bodyText: 'Oi',
    })

    expect(result.kind).toBe('attached')
    if (result.kind === 'attached') expect(result.conversationId).toBe(keep.id)
  })

  it('idempotente pelo id do provedor: a mesma recebida duas vezes não duplica (conversa)', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const conversation = await conversations.create({ companyId: COMPANY_ID })
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })
    const input = {
      companyId: COMPANY_ID,
      channel: 'email' as const,
      identifier: 'cliente@example.com',
      bodyText: 'Oi',
      providerMessageId: 'msg-provider-1',
      replyConversationId: conversation.id,
    }

    const first = await useCase.execute(input)
    const second = await useCase.execute(input)

    expect(first.kind).toBe('attached')
    expect(second.kind).toBe('attached')
    if (first.kind === 'attached' && second.kind === 'attached') expect(second.message.id).toBe(first.message.id)
    expect(messages.rows).toHaveLength(1)
  })

  it('idempotente pelo id do provedor: a mesma recebida duas vezes não duplica (fila)', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    for (const subjectId of ['lead-1', 'lead-2']) {
      const conversation = await conversations.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId })
      await conversations.addParticipant({
        companyId: COMPANY_ID,
        conversationId: conversation.id,
        channel: 'email',
        identifier: 'cliente@example.com',
      })
    }
    const useCase = new AttributeInboundMessageUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })
    const input = {
      companyId: COMPANY_ID,
      channel: 'email' as const,
      identifier: 'cliente@example.com',
      bodyText: 'Oi',
      providerMessageId: 'msg-provider-2',
    }

    const first = await useCase.execute(input)
    const second = await useCase.execute(input)

    expect(first.kind).toBe('unassigned')
    expect(second.kind).toBe('unassigned')
    expect(unassigned.rows).toHaveLength(1)
  })
})

describe('AssignUnassignedToConversationUseCase (RF7)', () => {
  it('atribui manualmente: grava a mensagem e assigned_* na fila, os três juntos', async () => {
    const conversations = createInMemoryConversations()
    const messages = createInMemoryMessages()
    const unassigned = createInMemoryUnassigned()
    const conversation = await conversations.create({ companyId: COMPANY_ID })
    const entry = await unassigned.create({
      companyId: COMPANY_ID,
      channel: 'email',
      senderAddress: 'cliente@example.com',
      bodyText: 'Oi',
      receivedAt: NOW,
    })
    const useCase = new AssignUnassignedToConversationUseCase({
      conversations,
      messages,
      unassigned,
      clock: createFixedClock(NOW),
    })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      unassignedId: entry.id,
      conversationId: conversation.id,
      assignedByUserId: 'user-1',
    })

    expect(result.message.conversationId).toBe(conversation.id)
    expect(result.entry.assignedMessageId).toBe(result.message.id)
    expect(result.entry.assignedByUserId).toBe('user-1')
    expect(result.entry.assignedAt).not.toBeNull()
  })
})
