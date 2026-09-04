/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que estes testes protegem aconteceu em produção: um deploy no meio da conversa matava a
 * chamada de rede em voo e o cliente ficava sem resposta. Pior, o nonce já tinha sido gravado com
 * a janela cheia — então a reentrega da Meta, único socorro que existe, batia numa porta fechada.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type { SessionState } from '@adatechnology/meta-whatsapp-contracts'
import { buildInboundTextPayload, serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { InboundEffectsDispatcher } from './inboundDispatch'
import type { InboundDispatchJob, InboundDispatchQueueInterface } from './inboundDispatch'
import { ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const PHONE_NUMBER_ID = '1129051206965973'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'

type NonceStoreSpy = NonceStoreInterface & { readonly confirmed: string[] }

function createNonceStore(): NonceStoreSpy {
  const keys = new Set<string>()
  const confirmed: string[] = []
  return {
    confirmed,
    async setIfAbsent(key: string): Promise<boolean> {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
    async confirm(key: string): Promise<void> {
      confirmed.push(key)
    },
  }
}

function createQueue(): InboundDispatchQueueInterface & {
  readonly enqueued: { job: InboundDispatchJob; jobId: string }[]
} {
  const enqueued: { job: InboundDispatchJob; jobId: string }[] = []
  return {
    enqueued,
    async enqueue(job: InboundDispatchJob, options: { jobId: string }): Promise<void> {
      enqueued.push({ job, jobId: options.jobId })
    },
  }
}

function createLogMessage(): LogMessageUseCase {
  return {
    async execute(): Promise<{ id: string; type: string; payload: unknown }> {
      return { id: 'msg-1', type: 'text', payload: null }
    },
  } as unknown as LogMessageUseCase
}

function createUseCase(overrides: {
  nonceStore: NonceStoreSpy
  inboundQueue?: InboundDispatchQueueInterface
  logMessage?: LogMessageUseCase
  hooks?: Record<string, unknown>
  sessionRepository?: SessionRepository
}): ReceiveWebhookUseCase {
  return new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: PHONE_NUMBER_ID,
    nonceStore: overrides.nonceStore,
    sessionRepository:
      overrides.sessionRepository ??
      ({
        async getContext(): Promise<null> {
          return null
        },
      } as unknown as SessionRepository),
    messageRepository: {} as unknown as MessageRepository,
    logMessage: overrides.logMessage ?? createLogMessage(),
    startState: 'inicio' as SessionState,
    ...(overrides.inboundQueue ? { inboundQueue: overrides.inboundQueue } : {}),
    ...(overrides.hooks ? { hooks: overrides.hooks as never } : {}),
  })
}

/**
 * O nome que a PESSOA escolheu no WhatsApp dela.
 *
 * A Meta entrega isso em `contacts`, ao lado das mensagens, e o módulo não o expunha: o cliente
 * criado a partir de uma mensagem nascia sem nome — mesmo com a Meta tendo mandado o nome junto.
 */

/** Sessão em modo bot: sem ela o dispatch retorna antes do hook, e o teste não mediria nada. */
function sessaoAtiva() {
  const agora = new Date()
  return {
    id: 'sess-1',
    companyId: COMPANY_ID,
    whatsappNumber: '5516999999999',
    currentState: 'inicio',
    flowKey: null,
    currentNodeId: null,
    context: {},
    mode: 'bot',
    assignedUserId: null,
    humanRequestedAt: null,
    lastInboundAt: null,
    lastAgentReadAt: null,
    lastActivity: agora,
    createdAt: agora,
    updatedAt: agora,
  }
}

function sessionRepositoryAtivo() {
  return {
    async getContext() {
      return sessaoAtiva()
    },
  } as unknown as SessionRepository
}

describe('nome de perfil do contato', () => {
  async function entregarComNome(params: { profileName?: string; inboundQueue?: ReturnType<typeof createQueue> }) {
    const recebidos: { profileName?: string }[] = []
    const useCase = createUseCase({
      nonceStore: createNonceStore(),
      sessionRepository: sessionRepositoryAtivo(),
      ...(params.inboundQueue ? { inboundQueue: params.inboundQueue } : {}),
      hooks: {
        onMessageReceived: async (_message: unknown, _session: unknown, contact?: { profileName?: string }) => {
          recebidos.push(contact ?? {})
        },
      },
    })

    const rawBody = serializeWebhookPayload(
      buildInboundTextPayload({
        from: '5516999999999',
        phoneNumberId: PHONE_NUMBER_ID,
        text: 'ola',
        ...(params.profileName ? { profileName: params.profileName } : {}),
      }),
    )

    await useCase.execute({
      companyId: COMPANY_ID,
      rawBody,
      signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
    })

    return recebidos
  }

  it('chega ao host quando a Meta o envia', async () => {
    const recebidos = await entregarComNome({ profileName: 'Joana Pereira' })

    expect(recebidos).toHaveLength(1)
    expect(recebidos[0]?.profileName).toBe('Joana Pereira')
  })

  it('webhook SEM contacts não inventa nome', async () => {
    const recebidos = await entregarComNome({})

    expect(recebidos[0]?.profileName).toBeUndefined()
  })

  it('sobrevive à ida pela FILA — o payload da Meta não existe mais quando o worker roda', async () => {
    const queue = createQueue()
    await entregarComNome({ profileName: 'Joana Pereira', inboundQueue: queue })

    const job = queue.enqueued[0]?.job
    expect(job?.kind).toBe('message')
    expect(job?.kind === 'message' ? job.profileName : undefined).toBe('Joana Pereira')
  })

  it('job ANTIGO, sem o campo, continua válido — subir o módulo não exige drenar a fila', async () => {
    const recebidos: { profileName?: string }[] = []
    const dispatcher = new InboundEffectsDispatcher({
      sessionRepository: sessionRepositoryAtivo(),
      hooks: {
        onMessageReceived: async (_m: unknown, _s: unknown, contact?: { profileName?: string }) => {
          recebidos.push(contact ?? {})
        },
      } as never,
    })

    await dispatcher.run({
      kind: 'message',
      companyId: COMPANY_ID,
      message: { id: 'wamid.1', from: '5516999999999', type: 'text', text: { body: 'oi' }, timestamp: '1' },
      savedMessageId: 'msg-1',
      receivedAt: 1,
    })

    expect(recebidos).toHaveLength(1)
    expect(recebidos[0]?.profileName).toBeUndefined()
  })
})
