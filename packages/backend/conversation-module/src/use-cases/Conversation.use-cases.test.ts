/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T205 (RF6, CA02): abrir conversa — com assunto e sem assunto pelo mesmo caso de uso.
 * Vermelho até a T206 criar `Conversation.use-cases.ts`.
 */
import { describe, expect, it } from 'bun:test'

import { createInMemoryConversations } from '../testing/inMemoryRepositories'
import { OpenConversationUseCase } from './Conversation.use-cases'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'

describe('OpenConversationUseCase (CA02)', () => {
  it('abre conversa com assunto e é idempotente por (empresa, subject_type, subject_id, audience)', async () => {
    const conversations = createInMemoryConversations()
    const useCase = new OpenConversationUseCase({ conversations })

    const first = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'email', identifier: 'cliente@example.com' },
      subject: { subjectType: 'lead', subjectId: 'lead-1', audience: 'customer' },
    })
    const second = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'email', identifier: 'cliente@example.com' },
      subject: { subjectType: 'lead', subjectId: 'lead-1', audience: 'customer' },
    })

    expect(second.id).toBe(first.id)
    expect(conversations.rows).toHaveLength(1)
  })

  it('duas audiências diferentes do mesmo assunto abrem conversas diferentes', async () => {
    const conversations = createInMemoryConversations()
    const useCase = new OpenConversationUseCase({ conversations })

    const customerConversation = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'email', identifier: 'cliente@example.com' },
      subject: { subjectType: 'lead', subjectId: 'lead-1', audience: 'customer' },
    })
    const partnerConversation = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'email', identifier: 'parceiro@example.com' },
      subject: { subjectType: 'lead', subjectId: 'lead-1', audience: 'partner' },
    })

    expect(customerConversation.id).not.toBe(partnerConversation.id)
  })

  it('abre conversa sem assunto e é idempotente pelo participante (canal, identificador)', async () => {
    const conversations = createInMemoryConversations()
    const useCase = new OpenConversationUseCase({ conversations })

    const first = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'whatsapp', identifier: '+5511999990000' },
    })
    const second = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'whatsapp', identifier: '+5511999990000' },
    })

    expect(second.id).toBe(first.id)
    expect(conversations.rows).toHaveLength(1)
    expect(first.subjectType).toBeNull()
  })

  it('participante diferente sem assunto abre outra conversa', async () => {
    const conversations = createInMemoryConversations()
    const useCase = new OpenConversationUseCase({ conversations })

    const first = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'whatsapp', identifier: '+5511999990000' },
    })
    const other = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'whatsapp', identifier: '+5511888880000' },
    })

    expect(other.id).not.toBe(first.id)
  })

  it('registra o participante na conversa aberta', async () => {
    const conversations = createInMemoryConversations()
    const useCase = new OpenConversationUseCase({ conversations })

    const conversation = await useCase.execute({
      companyId: COMPANY_ID,
      participant: { channel: 'email', identifier: 'cliente@example.com' },
      subject: { subjectType: 'lead', subjectId: 'lead-2' },
    })

    const participant = await conversations.findParticipant({
      companyId: COMPANY_ID,
      conversationId: conversation.id,
      channel: 'email',
      identifier: 'cliente@example.com',
    })
    expect(participant).toBeDefined()
  })
})
