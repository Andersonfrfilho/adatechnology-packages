/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T205 (RF6): marcar lido só avança, e não avisa a outra parte (não há porta de notificação nas
 * dependências do caso de uso). Vermelho até a T206 criar `Read.use-cases.ts`.
 */
import { describe, expect, it } from 'bun:test'

import { createFixedClock, createInMemoryMessages, createInMemoryReads } from '../testing/inMemoryRepositories'
import { MarkConversationReadUseCase } from './Read.use-cases'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '33333333-3333-3333-3333-333333333333'

describe('MarkConversationReadUseCase (RF6)', () => {
  it('marca a última mensagem lida', async () => {
    const messages = createInMemoryMessages()
    const reads = createInMemoryReads()
    const message = await messages.create({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'app',
      direction: 'inbound',
      automatic: false,
      authorUserId: 'contractor-1',
      bodyText: 'Oi',
      statusTimes: {},
    })
    const useCase = new MarkConversationReadUseCase({
      reads,
      messages,
      clock: createFixedClock(new Date('2026-09-26T12:00:00.000Z')),
    })

    const read = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      lastReadMessageId: message.id,
    })

    expect(read.lastReadMessageId).toBe(message.id)
  })

  it('só avança: marcar uma mensagem mais antiga como lida não retrocede', async () => {
    const messages = createInMemoryMessages()
    const reads = createInMemoryReads()
    const older = await messages.create({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'app',
      direction: 'inbound',
      automatic: false,
      authorUserId: 'contractor-1',
      bodyText: 'primeira',
      statusTimes: {},
      createdAt: new Date('2026-09-26T12:00:00.000Z'),
    })
    const newer = await messages.create({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'app',
      direction: 'inbound',
      automatic: false,
      authorUserId: 'contractor-1',
      bodyText: 'segunda',
      statusTimes: {},
      createdAt: new Date('2026-09-26T12:05:00.000Z'),
    })
    const useCase = new MarkConversationReadUseCase({
      reads,
      messages,
      clock: createFixedClock(new Date('2026-09-26T12:10:00.000Z')),
    })

    await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      lastReadMessageId: newer.id,
    })
    const result = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      lastReadMessageId: older.id,
    })

    expect(result.lastReadMessageId).toBe(newer.id)
  })
})
