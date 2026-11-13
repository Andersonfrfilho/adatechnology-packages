/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `features.redactInboundLocation`: a coordenada é dado pessoal e o transcript não tem finalidade
 * para ela. Ligada a opção, a linha grava só que houve uma localização; o gancho do host continua
 * recebendo a mensagem crua inteira (é dele que o despachante lê o ponto).
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type { SessionState, WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'
import { buildInboundLocationPayload, serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'
import { INBOUND_LOCATION_CONTENT } from '../inboundLocation.constant'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageParams, LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { extractContent, ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const PHONE_NUMBER_ID = '1129051206965973'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const LOCATION = {
  latitude: -20.5386,
  longitude: -47.4008,
  name: 'Casa',
  address: 'Rua Exemplo, 123',
  url: 'https://maps.example/?q=-20.5386,-47.4008',
} as const
const REFERRED_PRODUCT = { catalog_id: 'cat-1', product_retailer_id: 'sku-1' } as const

function createNonceStore(): NonceStoreInterface {
  const keys = new Set<string>()
  return {
    async setIfAbsent(key: string): Promise<boolean> {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
    async confirm(): Promise<void> {},
  }
}

function activeSession(): SessionRepository {
  const now = new Date()
  return {
    async getContext() {
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
        lastActivity: now,
        createdAt: now,
        updatedAt: now,
      }
    },
  } as unknown as SessionRepository
}

type Deliveries = { logged: LogMessageParams[]; hooked: WhatsAppMessage[] }

async function deliverLocation(options: {
  redactInboundLocation?: boolean
  withReferredProduct?: boolean
}): Promise<Deliveries> {
  const deliveries: Deliveries = { logged: [], hooked: [] }
  const logMessage = {
    async execute(input: LogMessageParams) {
      deliveries.logged.push(input)
      return { id: 'msg-1', type: input.type, payload: input.payload }
    },
  } as unknown as LogMessageUseCase

  const useCase = new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: PHONE_NUMBER_ID,
    nonceStore: createNonceStore(),
    sessionRepository: activeSession(),
    messageRepository: {} as unknown as MessageRepository,
    logMessage,
    startState: 'inicio' as SessionState,
    hooks: {
      onMessageReceived: async (message: unknown) => {
        deliveries.hooked.push(message as WhatsAppMessage)
      },
    } as never,
    ...(options.redactInboundLocation === undefined ? {} : { redactInboundLocation: options.redactInboundLocation }),
  })

  const webhookPayload = buildInboundLocationPayload({
    from: '5516999999999',
    phoneNumberId: PHONE_NUMBER_ID,
    latitude: LOCATION.latitude,
    longitude: LOCATION.longitude,
  })
  const message = webhookPayload.entry[0]!.changes[0]!.value.messages![0]!
  message.location = { ...LOCATION }
  if (options.withReferredProduct) message.context = { referred_product: { ...REFERRED_PRODUCT } }

  const rawBody = serializeWebhookPayload(webhookPayload)
  await useCase.execute({
    companyId: COMPANY_ID,
    rawBody,
    signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
  })
  return deliveries
}

describe('redactInboundLocation ligada', () => {
  it('grava a linha sem payload.location e sem o rótulo, mantendo type location', async () => {
    const { logged } = await deliverLocation({ redactInboundLocation: true })

    expect(logged).toHaveLength(1)
    expect(logged[0]?.type).toBe('location')
    expect(logged[0]?.payload).toBeNull()
    expect(logged[0]?.content).toBe(INBOUND_LOCATION_CONTENT)
    expect(logged[0]?.content).not.toContain('Casa')
    expect(logged[0]?.content).not.toContain('Rua')
  })

  it('o gancho continua recebendo a location inteira', async () => {
    const { hooked } = await deliverLocation({ redactInboundLocation: true })

    expect(hooked).toHaveLength(1)
    expect(hooked[0]?.location).toEqual({ ...LOCATION })
  })

  it('só location sai: outra chave do payload fica', async () => {
    const { logged } = await deliverLocation({ redactInboundLocation: true, withReferredProduct: true })

    expect(logged[0]?.payload).toEqual({ referredProduct: REFERRED_PRODUCT })
  })
})

describe('redactInboundLocation desligada (padrão)', () => {
  it.each([undefined, false])('comportamento da 0.7.0 com a opção %p', async (redactInboundLocation) => {
    const { logged } = await deliverLocation(redactInboundLocation === undefined ? {} : { redactInboundLocation })

    expect(logged[0]?.payload).toEqual({ location: { ...LOCATION } })
    expect(logged[0]?.content).toBe('📍 Localização: Casa')
  })
})

describe('extractContent', () => {
  const message: WhatsAppMessage = {
    id: 'wamid.1',
    from: '5516999999999',
    type: 'location',
    location: { ...LOCATION },
    timestamp: '1700000000',
  }

  it('sem o segundo argumento preserva o rótulo', () => {
    expect(extractContent(message)).toBe('📍 Localização: Casa')
  })

  it('com isLocationRedacted devolve a constante, sem rótulo', () => {
    expect(extractContent(message, { isLocationRedacted: true })).toBe(INBOUND_LOCATION_CONTENT)
  })
})
