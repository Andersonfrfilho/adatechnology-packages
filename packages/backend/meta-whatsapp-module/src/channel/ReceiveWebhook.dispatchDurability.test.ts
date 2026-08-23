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

function entregar(useCase: ReceiveWebhookUseCase) {
  const rawBody = serializeWebhookPayload(
    buildInboundTextPayload({
      from: '5516999999999',
      phoneNumberId: PHONE_NUMBER_ID,
      text: 'ola',
    }),
  )
  return useCase.execute({
    companyId: COMPANY_ID,
    rawBody,
    signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
  })
}

describe('ReceiveWebhookUseCase — porta de fila', () => {
  it('enfileira os efeitos com jobId estável em vez de rodá-los na requisição', async () => {
    const queue = createQueue()
    let hookChamado = false
    const useCase = createUseCase({
      nonceStore: createNonceStore(),
      inboundQueue: queue,
      hooks: {
        onMessageReceived: async (): Promise<void> => {
          hookChamado = true
        },
      },
    })

    const result = await entregar(useCase)

    expect(result.messagesProcessed).toBe(1)
    expect(hookChamado).toBe(false)
    expect(queue.enqueued).toHaveLength(1)
    const [enfileirado] = queue.enqueued
    expect(enfileirado!.job.kind).toBe('message')
    expect(enfileirado!.jobId).toBe(
      `wa-inbound-message:${(enfileirado!.job as { message: { id: string } }).message.id}`,
    )
  })

  it('sem fila configurada, roda os efeitos inline — comportamento de antes preservado', async () => {
    let hookChamado = false
    const useCase = createUseCase({
      nonceStore: createNonceStore(),
      sessionRepository: {
        async getContext(): Promise<null> {
          hookChamado = true
          return null
        },
      } as unknown as SessionRepository,
    })

    await entregar(useCase)

    expect(hookChamado).toBe(true)
  })
})

describe('ReceiveWebhookUseCase — nonce só fecha depois de processar', () => {
  it('confirma a entrega quando o processamento vai até o fim', async () => {
    const nonceStore = createNonceStore()
    await entregar(createUseCase({ nonceStore, inboundQueue: createQueue() }))

    expect(nonceStore.confirmed).toHaveLength(1)
  })

  it('não confirma quando o processamento falha, para a reentrega da Meta ainda valer', async () => {
    const nonceStore = createNonceStore()
    const queue: InboundDispatchQueueInterface = {
      async enqueue(): Promise<void> {
        throw new Error('redis indisponível')
      },
    }

    await expect(entregar(createUseCase({ nonceStore, inboundQueue: queue }))).rejects.toThrow('redis indisponível')
    expect(nonceStore.confirmed).toEqual([])
  })
})
