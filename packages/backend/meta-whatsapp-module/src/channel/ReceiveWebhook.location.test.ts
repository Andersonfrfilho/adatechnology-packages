/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Mensagem de localização (botão "Localização" do app do cliente). O QuickCart usa a coordenada
 * para calcular taxa de entrega por distância — o hook do host precisa recebê-la intacta, e a
 * coordenada não pode vazar em log de servidor (é dado pessoal: a casa do cliente).
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it, mock } from 'bun:test'
import type { SessionState, WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'
import { buildInboundLocationPayload, serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase, LogMessageParams } from '../use-cases/LogMessage.use-case'
import { extractContent, ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const PHONE_NUMBER_ID = '1129051206965973'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const LATITUDE = -20.5386
const LONGITUDE = -47.4008

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

async function entregarLocalizacao(params: {
  onMessageReceived: (message: unknown) => Promise<void>
  logMessage: LogMessageUseCase
}) {
  const useCase = new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: PHONE_NUMBER_ID,
    nonceStore: createNonceStore(),
    sessionRepository: sessionRepositoryAtivo(),
    messageRepository: {} as unknown as MessageRepository,
    logMessage: params.logMessage,
    startState: 'inicio' as SessionState,
    hooks: { onMessageReceived: params.onMessageReceived } as never,
  })

  const rawBody = serializeWebhookPayload(
    buildInboundLocationPayload({
      from: '5516999999999',
      phoneNumberId: PHONE_NUMBER_ID,
      latitude: LATITUDE,
      longitude: LONGITUDE,
      name: 'Casa',
      address: 'Rua Exemplo, 123',
    }),
  )

  await useCase.execute({
    companyId: COMPANY_ID,
    rawBody,
    signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
  })
}

describe('mensagem de localização', () => {
  it('chega ao hook onMessageReceived com message.location preenchido', async () => {
    const recebidos: WhatsAppMessage[] = []
    let loggedContent: string | null | undefined
    let loggedPayload: unknown

    const logMessage = {
      async execute(input: LogMessageParams) {
        loggedContent = input.content
        loggedPayload = input.payload
        return { id: 'msg-1', type: 'location', payload: input.payload }
      },
    } as unknown as LogMessageUseCase

    await entregarLocalizacao({
      onMessageReceived: async (message: unknown) => {
        recebidos.push(message as WhatsAppMessage)
      },
      logMessage,
    })

    expect(recebidos).toHaveLength(1)
    expect(recebidos[0]?.location).toEqual({
      latitude: LATITUDE,
      longitude: LONGITUDE,
      name: 'Casa',
      address: 'Rua Exemplo, 123',
    })

    // Conteúdo legível para o atendente na inbox.
    expect(loggedContent).toContain('📍')
    expect(loggedContent).toContain('Casa')

    // Payload guarda a coordenada, para o QuickCart calcular a taxa de entrega.
    expect(loggedPayload).toEqual({
      location: { latitude: LATITUDE, longitude: LONGITUDE, name: 'Casa', address: 'Rua Exemplo, 123' },
    })
  })

  it('extractContent produz texto legível sem name/address', () => {
    const message: WhatsAppMessage = {
      id: 'wamid.1',
      from: '5516999999999',
      type: 'location',
      location: { latitude: LATITUDE, longitude: LONGITUDE },
      timestamp: '1700000000',
    }

    expect(extractContent(message)).toBe('📍 Localização')
  })

  it('nenhum log de servidor imprime a latitude/longitude', async () => {
    const consoleSpy = {
      log: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    }
    const original = { ...console }
    Object.assign(console, consoleSpy)

    try {
      await entregarLocalizacao({
        onMessageReceived: async () => {},
        logMessage: {
          async execute() {
            return { id: 'msg-1', type: 'location', payload: null }
          },
        } as unknown as LogMessageUseCase,
      })
    } finally {
      Object.assign(console, original)
    }

    const allCalls = [
      ...consoleSpy.log.mock.calls,
      ...consoleSpy.warn.mock.calls,
      ...consoleSpy.error.mock.calls,
      ...consoleSpy.info.mock.calls,
      ...consoleSpy.debug.mock.calls,
    ]

    expect(allCalls).toHaveLength(0)
    for (const call of allCalls) {
      const serialized = JSON.stringify(call)
      expect(serialized.includes(String(LATITUDE))).toBe(false)
      expect(serialized.includes(String(LONGITUDE))).toBe(false)
    }
  })
})
