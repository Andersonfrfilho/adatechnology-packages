/**
 * Recusa de entrega chega pelo webhook de status, não pela resposta do envio: a Meta responde 200
 * ao `POST /messages` e só depois manda `failed`. Enquanto o motivo era descartado, todo envio
 * recusado ficava indistinguível de um bug do host — o cliente não recebia nada, e nem o log nem a
 * linha da mensagem sabiam dizer por quê.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type { MetaWhatsAppHooks, SessionState, WhatsAppStatus } from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository, UpdateMessageStatusParams } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const NOSSO_NUMERO = '1307146062476376'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const NUMERO_DO_CLIENTE = '5511988887777'
const WAMID = 'wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='

const RECUSA_POR_PAIS = {
  code: 130497,
  title: 'Business account is restricted from messaging users in this country.',
  error_data: { details: 'Business account is restricted from messaging users in this country.' },
}

type Capturas = {
  readonly gravacoes: UpdateMessageStatusParams[]
  readonly statusNoHook: WhatsAppStatus[]
}

function createNonceStore(): NonceStoreInterface {
  const keys = new Set<string>()
  return {
    async setIfAbsent(key: string): Promise<boolean> {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
  }
}

function createUseCase(): { useCase: ReceiveWebhookUseCase; capturas: Capturas } {
  const capturas: Capturas = { gravacoes: [], statusNoHook: [] }

  const messageRepository = {
    async updateMessageStatus(params: UpdateMessageStatusParams) {
      capturas.gravacoes.push(params)
      return { whatsappNumber: NUMERO_DO_CLIENTE }
    },
  } as unknown as MessageRepository

  const sessionRepository = {
    async getContext() {
      return undefined
    },
  } as unknown as SessionRepository

  const hooks: MetaWhatsAppHooks = {
    onStatusUpdate: async (status) => {
      capturas.statusNoHook.push(status)
    },
  }

  const useCase = new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: NOSSO_NUMERO,
    nonceStore: createNonceStore(),
    sessionRepository,
    messageRepository,
    logMessage: {} as unknown as LogMessageUseCase,
    startState: 'inicio' as SessionState,
    hooks,
  })

  return { useCase, capturas }
}

function entregarStatus(useCase: ReceiveWebhookUseCase, status: unknown) {
  const rawBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15556740736', phone_number_id: NOSSO_NUMERO },
              statuses: [status],
            },
          },
        ],
      },
    ],
  })
  const assinatura = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
  return useCase.execute({ companyId: COMPANY_ID, rawBody, signatureHeader: assinatura })
}

describe('recusa de entrega no webhook de status', () => {
  it('grava o motivo da recusa na mensagem', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregarStatus(useCase, {
      id: WAMID,
      status: 'failed',
      timestamp: '1759100000',
      recipient_id: NUMERO_DO_CLIENTE,
      errors: [RECUSA_POR_PAIS],
    })

    expect(resultado.statusesProcessed).toBe(1)
    expect(capturas.gravacoes).toHaveLength(1)
    expect(capturas.gravacoes[0]?.status).toBe('failed')
    expect(capturas.gravacoes[0]?.deliveryError?.code).toBe(130497)
  })

  it('entrega o motivo ao host, que é quem pode reagir na hora', async () => {
    const { useCase, capturas } = createUseCase()

    await entregarStatus(useCase, {
      id: WAMID,
      status: 'failed',
      timestamp: '1759100000',
      errors: [RECUSA_POR_PAIS],
    })

    expect(capturas.statusNoHook).toHaveLength(1)
    expect(capturas.statusNoHook[0]?.errors?.[0]?.code).toBe(130497)
  })

  it('entrega que deu certo não inventa motivo nenhum', async () => {
    const { useCase, capturas } = createUseCase()

    await entregarStatus(useCase, { id: WAMID, status: 'delivered', timestamp: '1759100000' })

    expect(capturas.gravacoes[0]?.deliveryError).toBeUndefined()
  })

  it('recusa sem detalhe ainda marca a mensagem como falha', async () => {
    const { useCase, capturas } = createUseCase()

    await entregarStatus(useCase, { id: WAMID, status: 'failed', timestamp: '1759100000' })

    expect(capturas.gravacoes[0]?.status).toBe('failed')
    expect(capturas.gravacoes[0]?.deliveryError).toBeUndefined()
  })

  it('campo novo da Meta dentro do erro não derruba a entrega', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregarStatus(useCase, {
      id: WAMID,
      status: 'failed',
      timestamp: '1759100000',
      errors: [{ ...RECUSA_POR_PAIS, campo_que_ainda_nao_existe: { qualquer: 'coisa' } }],
    })

    expect(resultado.statusesProcessed).toBe(1)
    expect(capturas.gravacoes[0]?.deliveryError?.code).toBe(130497)
  })
})
