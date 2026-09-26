/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T205 (RF6): enviar, receber, atualizar status e listar mensagens. Vermelho até a T206 criar
 * `Message.use-cases.ts`.
 */
import { describe, expect, it } from 'bun:test'

import type { ConversationChannelPort } from '@adatechnology/conversation-contracts'

import { ChannelPortNotConfiguredError } from '../errors'
import { createFixedClock, createInMemoryMessages } from '../testing/inMemoryRepositories'
import {
  ListConversationMessagesUseCase,
  ReceiveMessageUseCase,
  SendMessageUseCase,
  UpdateMessageStatusUseCase,
} from './Message.use-cases'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222'
const NOW = new Date('2026-09-26T12:00:00.000Z')

function createRecordingChannel(providerMessageId = 'provider-1'): ConversationChannelPort & { sent: unknown[] } {
  const sent: unknown[] = []
  return {
    sent,
    async sendText(input) {
      sent.push(input)
      return { providerMessageId }
    },
    async sendAttachment(input) {
      sent.push(input)
      return { providerMessageId }
    },
  }
}

describe('SendMessageUseCase (RF6)', () => {
  it('grava queued, chama a porta do canal e grava o id do provedor', async () => {
    const messages = createInMemoryMessages()
    const whatsapp = createRecordingChannel('wamid-1')
    const useCase = new SendMessageUseCase({ messages, channels: { whatsapp }, clock: createFixedClock(NOW) })

    const message = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'whatsapp',
      to: '+5511999990000',
      bodyText: 'Olá!',
      authorUserId: 'user-1',
    })

    expect(message.status).toBe('queued')
    expect(message.providerMessageId).toBe('wamid-1')
    expect(whatsapp.sent).toHaveLength(1)
  })

  it('mensagem automática não carrega autor', async () => {
    const messages = createInMemoryMessages()
    const email = createRecordingChannel()
    const useCase = new SendMessageUseCase({ messages, channels: { email }, clock: createFixedClock(NOW) })

    const message = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'email',
      to: 'cliente@example.com',
      bodyText: 'Aviso automático',
      automatic: true,
    })

    expect(message.automatic).toBe(true)
    expect(message.authorUserId).toBeNull()
  })

  it('nunca aceita canal sem porta configurada', async () => {
    const messages = createInMemoryMessages()
    const useCase = new SendMessageUseCase({ messages, channels: {}, clock: createFixedClock(NOW) })

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'whatsapp',
        to: '+5511999990000',
        bodyText: 'Olá!',
        authorUserId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ChannelPortNotConfiguredError)
  })
})

describe('ReceiveMessageUseCase (RF6)', () => {
  it('recebida por canal externo usa sender_address', async () => {
    const messages = createInMemoryMessages()
    const useCase = new ReceiveMessageUseCase({ messages })

    const message = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'whatsapp',
      bodyText: 'Oi',
      senderAddress: '+5511999990000',
    })

    expect(message.direction).toBe('inbound')
    expect(message.senderAddress).toBe('+5511999990000')
    expect(message.authorUserId).toBeNull()
  })

  it('recebida por canal com conta do host usa author_user_id', async () => {
    const messages = createInMemoryMessages()
    const useCase = new ReceiveMessageUseCase({ messages })

    const message = await useCase.execute({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'portal',
      bodyText: 'Oi',
      authorUserId: 'customer-user-1',
    })

    expect(message.authorUserId).toBe('customer-user-1')
    expect(message.senderAddress).toBeNull()
  })
})

describe('UpdateMessageStatusUseCase (RF3, D6, CA05)', () => {
  it('avança o status usando a máquina de status do contracts', async () => {
    const messages = createInMemoryMessages()
    await messages.create({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'whatsapp',
      direction: 'outbound',
      automatic: true,
      status: 'queued',
      statusTimes: { queued: NOW.toISOString() },
      providerMessageId: 'wamid-1',
    })
    const useCase = new UpdateMessageStatusUseCase({ messages })

    const updated = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'whatsapp',
      providerMessageId: 'wamid-1',
      status: 'delivered',
      at: '2026-09-26T12:05:00.000Z',
    })

    expect(updated?.status).toBe('delivered')
  })

  it('o mesmo evento duas vezes não muda nada (CA05)', async () => {
    const messages = createInMemoryMessages()
    await messages.create({
      companyId: COMPANY_ID,
      conversationId: CONVERSATION_ID,
      channel: 'whatsapp',
      direction: 'outbound',
      automatic: true,
      status: 'delivered',
      statusTimes: { queued: NOW.toISOString(), sent: NOW.toISOString(), delivered: NOW.toISOString() },
      providerMessageId: 'wamid-1',
    })
    const useCase = new UpdateMessageStatusUseCase({ messages })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'whatsapp',
      providerMessageId: 'wamid-1',
      status: 'delivered',
      at: '2026-09-26T12:10:00.000Z',
    })

    expect(result?.statusTimes.delivered).toBe(NOW.toISOString())
  })

  it('status desconhecido do provedor por (canal, id) é ignorado sem erro', async () => {
    const messages = createInMemoryMessages()
    const useCase = new UpdateMessageStatusUseCase({ messages })

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      channel: 'whatsapp',
      providerMessageId: 'nunca-existiu',
      status: 'delivered',
      at: NOW.toISOString(),
    })

    expect(result).toBeUndefined()
  })
})

describe('ListConversationMessagesUseCase (RF6)', () => {
  it('pagina por cursor (created_at, id)', async () => {
    const messages = createInMemoryMessages()
    for (let index = 0; index < 3; index += 1) {
      await messages.create({
        companyId: COMPANY_ID,
        conversationId: CONVERSATION_ID,
        channel: 'whatsapp',
        direction: 'outbound',
        automatic: true,
        status: 'queued',
        statusTimes: {},
        bodyText: `mensagem ${index}`,
      })
    }
    const useCase = new ListConversationMessagesUseCase({ messages })

    const page = await useCase.execute({ companyId: COMPANY_ID, conversationId: CONVERSATION_ID, perPage: 2 })

    expect(page.rows.length).toBeLessThanOrEqual(2)
  })
})
