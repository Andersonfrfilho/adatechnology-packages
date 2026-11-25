import { describe, expect, it } from 'bun:test'
import {
  SessionNotFoundError,
  type ConversationModeChange,
  type ConversationSession,
} from '@adatechnology/meta-whatsapp-contracts'

import { TakeoverConversationUseCase } from './TakeoverConversation.use-case'
import { ReleaseConversationUseCase } from './ReleaseConversation.use-case'
import { RequestHumanConversationUseCase } from './RequestHumanConversation.use-case'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SessionRow } from '../schema/schema'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const NUMBER = '5511999990000'

function sessionRow(): SessionRow {
  const now = new Date('2026-11-25T12:00:00Z')
  return {
    id: 'session-1',
    companyId: COMPANY_ID,
    whatsappNumber: NUMBER,
    currentState: 'start',
    flowKey: null,
    currentNodeId: null,
    context: {},
    mode: 'bot',
    assignedUserId: null,
    humanRequestedAt: now,
    lastInboundAt: now,
    lastAgentReadAt: null,
    lastActivity: now,
    createdAt: now,
    updatedAt: now,
  } as SessionRow
}

function buildRepository(options: { readonly isSessionMissing?: boolean } = {}) {
  const row = options.isSessionMissing ? undefined : sessionRow()
  const calls: string[] = []
  const repository = {
    takeover: async () => void calls.push('takeover'),
    release: async () => void calls.push('release'),
    requestHuman: async () => void calls.push('requestHuman'),
    getContext: async () => row,
  } as unknown as SessionRepository
  return { repository, calls }
}

function recordingHooks() {
  const changes: ConversationModeChange[] = []
  const humanRequested: ConversationSession[] = []
  return {
    changes,
    humanRequested,
    hooks: {
      onConversationModeChanged: async (change: ConversationModeChange) => void changes.push(change),
      onHumanRequested: async (session: ConversationSession) => void humanRequested.push(session),
    },
  }
}

describe('onConversationModeChanged', () => {
  it('takeover: ator é o atendente, ou quem o host informar', async () => {
    const { repository } = buildRepository()
    const { hooks, changes } = recordingHooks()
    const useCase = new TakeoverConversationUseCase(repository, undefined, hooks)

    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER, agentUserId: 'agent-1' })
    await useCase.execute({
      companyId: COMPANY_ID,
      whatsappNumber: NUMBER,
      agentUserId: 'agent-2',
      actorId: 'supervisor',
    })

    expect(changes[0]).toMatchObject({ kind: 'takeover', mode: 'human', assignedUserId: 'agent-1', actorId: 'agent-1' })
    expect(changes[1]).toMatchObject({ assignedUserId: 'agent-2', actorId: 'supervisor' })
    expect(changes[0]?.occurredAt).toBeInstanceOf(Date)
  })

  it('release: ator informado, ou null quando é o sistema', async () => {
    const { repository } = buildRepository()
    const { hooks, changes } = recordingHooks()
    const useCase = new ReleaseConversationUseCase(repository, undefined, hooks)

    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER, actorId: 'agent-1' })
    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })

    expect(changes.map((change) => [change.kind, change.mode, change.actorId])).toEqual([
      ['release', 'bot', 'agent-1'],
      ['release', 'bot', null],
    ])
  })

  it('requestHuman: grava o pedido, dispara onHumanRequested e o hook de modo', async () => {
    const { repository, calls } = buildRepository()
    const { hooks, changes, humanRequested } = recordingHooks()
    const useCase = new RequestHumanConversationUseCase(repository, undefined, hooks)

    await useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })

    expect(calls).toEqual(['requestHuman'])
    expect(humanRequested[0]?.humanRequestedAt).toBe('2026-11-25T12:00:00.000Z')
    expect(changes[0]).toMatchObject({ kind: 'human-requested', mode: 'bot', assignedUserId: null, actorId: null })
  })

  it('requestHuman: falha no aviso à equipe não apaga a trilha de auditoria', async () => {
    const { repository } = buildRepository()
    const changes: ConversationModeChange[] = []
    const useCase = new RequestHumanConversationUseCase(repository, undefined, {
      onHumanRequested: async () => {
        throw new Error('notifier down')
      },
      onConversationModeChanged: async (change) => void changes.push(change),
    })

    await expect(useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })).rejects.toThrow('notifier down')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.kind).toBe('human-requested')
  })

  it('requestHuman em conversa inexistente: SessionNotFoundError', async () => {
    const { repository } = buildRepository({ isSessionMissing: true })
    const useCase = new RequestHumanConversationUseCase(repository)

    await expect(useCase.execute({ companyId: COMPANY_ID, whatsappNumber: NUMBER })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    )
  })

  it('sem hooks, nada muda para quem já usava', async () => {
    const { repository, calls } = buildRepository()
    await new TakeoverConversationUseCase(repository).execute({
      companyId: COMPANY_ID,
      whatsappNumber: NUMBER,
      agentUserId: 'a',
    })
    expect(calls).toEqual(['takeover'])
  })
})
