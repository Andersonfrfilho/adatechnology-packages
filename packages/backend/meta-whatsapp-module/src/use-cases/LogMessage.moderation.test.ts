import { describe, expect, it } from 'bun:test'

import { LogMessageUseCase, type MessageModerator } from './LogMessage.use-case'
import type { MessageRepository, InsertMessageParams } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { MessageRow } from '../schema/schema'

const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const COMPANY_ID = '22222222-2222-2222-2222-222222222222'

function buildDependencies() {
  const inserted: InsertMessageParams[] = []

  const sessionRepository = {
    getOrCreate: async () => ({ id: SESSION_ID }),
    touchInbound: async () => undefined,
  } as unknown as SessionRepository

  const messageRepository = {
    insertMessage: async (params: InsertMessageParams) => {
      inserted.push(params)
      return { id: 'message-id' } as MessageRow
    },
  } as unknown as MessageRepository

  return { inserted, sessionRepository, messageRepository }
}

const offensiveModerator: MessageModerator = {
  inspect: (text: string) =>
    text.includes('babaca')
      ? { isOffensive: true, matchedTerms: ['babaca'] }
      : { isOffensive: false, matchedTerms: [] },
}

function inboundParams(content: string | null) {
  return {
    companyId: COMPANY_ID,
    whatsappNumber: '5511999999999',
    direction: 'inbound' as const,
    sender: 'customer' as const,
    type: 'text',
    content,
    startState: 'start' as never,
  }
}

describe('LogMessageUseCase — moderação', () => {
  it('marca a mensagem do cliente quando o moderador acusa', async () => {
    const { inserted, sessionRepository, messageRepository } = buildDependencies()
    const useCase = new LogMessageUseCase(sessionRepository, messageRepository, undefined, offensiveModerator)

    await useCase.execute(inboundParams('seu babaca'))

    expect(inserted[0]?.moderationFlagged).toBe(true)
    expect(inserted[0]?.moderationTerms).toEqual(['babaca'])
  })

  it('grava avaliado-e-limpo como false, não como nulo', async () => {
    const { inserted, sessionRepository, messageRepository } = buildDependencies()
    const useCase = new LogMessageUseCase(sessionRepository, messageRepository, undefined, offensiveModerator)

    await useCase.execute(inboundParams('quero 2kg de arroz'))

    expect(inserted[0]?.moderationFlagged).toBe(false)
    expect(inserted[0]?.moderationTerms).toBeNull()
  })

  // Sem moderador a coluna fica nula: "não avaliado" tem de ser distinguível de "limpo", senão
  // mensagem antiga passa a se parecer com mensagem verificada.
  it('sem moderador não toca nas colunas', async () => {
    const { inserted, sessionRepository, messageRepository } = buildDependencies()
    const useCase = new LogMessageUseCase(sessionRepository, messageRepository)

    await useCase.execute(inboundParams('seu babaca'))

    expect(inserted[0]?.moderationFlagged).toBeUndefined()
    expect(inserted[0]?.moderationTerms).toBeUndefined()
  })

  it('não modera o que o atendente ou o bot enviam', async () => {
    const { inserted, sessionRepository, messageRepository } = buildDependencies()
    const useCase = new LogMessageUseCase(sessionRepository, messageRepository, undefined, offensiveModerator)

    await useCase.execute({ ...inboundParams('seu babaca'), direction: 'outbound', sender: 'agent' })

    expect(inserted[0]?.moderationFlagged).toBeUndefined()
  })

  it('ignora mensagem sem texto (mídia, por exemplo)', async () => {
    const { inserted, sessionRepository, messageRepository } = buildDependencies()
    const useCase = new LogMessageUseCase(sessionRepository, messageRepository, undefined, offensiveModerator)

    await useCase.execute({ ...inboundParams(null), type: 'image' })
    await useCase.execute({ ...inboundParams('   '), type: 'text' })

    expect(inserted[0]?.moderationFlagged).toBeUndefined()
    expect(inserted[1]?.moderationFlagged).toBeUndefined()
  })
})
