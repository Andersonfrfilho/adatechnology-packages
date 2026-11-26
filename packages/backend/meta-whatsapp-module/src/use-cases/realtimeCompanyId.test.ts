/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Todo evento em `conv:<número>` carrega `companyId`: o canal é por número, e um host com várias
 * empresas não deveria ter de buscar a sessão pelo número para saber de quem é o evento.
 */

import { describe, expect, it } from 'bun:test'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import { LogMessageUseCase } from './LogMessage.use-case'
import { ReleaseConversationUseCase } from './ReleaseConversation.use-case'
import { RequestHumanConversationUseCase } from './RequestHumanConversation.use-case'
import { TakeoverConversationUseCase } from './TakeoverConversation.use-case'

const COMPANY_ID = 'company-1'
const NUMBER = '5511999990000'

function recordingNotifier(): { notifier: RealtimeNotifierInterface; conversationEvents: Record<string, unknown>[] } {
  const conversationEvents: Record<string, unknown>[] = []
  return {
    conversationEvents,
    notifier: {
      emit: (channel, _event, payload) => {
        if (channel === `conv:${NUMBER}`) conversationEvents.push(payload)
      },
    },
  }
}

const sessionRepository = {
  takeover: async () => undefined,
  release: async () => undefined,
  requestHuman: async () => undefined,
  getContext: async () => ({ humanRequestedAt: new Date('2026-11-25T12:00:00Z') }),
  getOrCreate: async () => ({ id: 'session-1' }),
  touchInbound: async () => undefined,
} as unknown as SessionRepository

describe('realtime conversation events', () => {
  it('carry the companyId on mode changes, human requests and messages', async () => {
    const { notifier, conversationEvents } = recordingNotifier()
    const messageRepository = { insertMessage: async () => ({ id: 'message-1' }) } as unknown as MessageRepository
    const target = { companyId: COMPANY_ID, whatsappNumber: NUMBER }

    await new TakeoverConversationUseCase(sessionRepository, notifier).execute({ ...target, agentUserId: 'agent-1' })
    await new ReleaseConversationUseCase(sessionRepository, notifier).execute(target)
    await new RequestHumanConversationUseCase(sessionRepository, notifier).execute(target)
    await new LogMessageUseCase(sessionRepository, messageRepository, notifier).execute({
      ...target,
      direction: 'inbound',
      sender: 'customer',
      type: 'text',
      body: 'oi',
      startState: 'start',
    } as Parameters<LogMessageUseCase['execute']>[0])

    expect(conversationEvents).toHaveLength(4)
    for (const payload of conversationEvents) expect(payload.companyId).toBe(COMPANY_ID)
  })
})
