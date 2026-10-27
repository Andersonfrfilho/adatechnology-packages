/**
 * A Meta reentrega todo webhook que não responde 2xx, e desativa a inscrição de quem falha com
 * frequência. Recusa determinística de envio — token sem escopo, conta barrada de mandar para o
 * país — falha igual em toda reentrega: deixar ela subir troca uma resposta de bot perdida pelo
 * canal inteiro desligado.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import { WhatsAppConnectionError, WhatsAppRejectionError } from '@adatechnology/meta-graph-core'
import type {
  InboundEffectRejectedDescriptor,
  MetaWhatsAppHooks,
  SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const NOSSO_NUMERO = '1307146062476376'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const NUMERO_DO_CLIENTE = '5511988887777'
const WAMID = 'wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='

/** O que a Graph API devolve quando o token não tem `whatsapp_business_messaging`. */
const TOKEN_SEM_ESCOPO = new WhatsAppRejectionError('200', 'Application does not have permission for this action', null)

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

const SESSAO = {
  id: 'session-1',
  companyId: COMPANY_ID,
  whatsappNumber: NUMERO_DO_CLIENTE,
  currentState: 'inicio',
  flowKey: null,
  currentNodeId: null,
  context: {},
  mode: 'bot',
  assignedUserId: null,
  humanRequestedAt: null,
  lastInboundAt: null,
  lastAgentReadAt: null,
  lastActivity: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createUseCase(falhaDoHook: unknown, hooks: Partial<MetaWhatsAppHooks> = {}): ReceiveWebhookUseCase {
  return new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: NOSSO_NUMERO,
    nonceStore: createNonceStore(),
    sessionRepository: {
      async getContext() {
        return SESSAO
      },
    } as unknown as SessionRepository,
    messageRepository: {} as unknown as MessageRepository,
    logMessage: {
      async execute() {
        return { id: 'message-1', type: 'text', payload: null, whatsappNumber: NUMERO_DO_CLIENTE }
      },
    } as unknown as LogMessageUseCase,
    startState: 'inicio' as SessionState,
    hooks: {
      onMessageReceived: async () => {
        throw falhaDoHook
      },
      ...hooks,
    },
  })
}

function createUseCaseComCaptura(falhaDoHook: unknown): {
  useCase: ReceiveWebhookUseCase
  recusas: InboundEffectRejectedDescriptor[]
} {
  const recusas: InboundEffectRejectedDescriptor[] = []
  const useCase = createUseCase(falhaDoHook, {
    onInboundEffectRejected: (details) => {
      recusas.push(details)
    },
  })
  return { useCase, recusas }
}

function entregarMensagem(useCase: ReceiveWebhookUseCase) {
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
              contacts: [{ profile: { name: 'Cliente' }, wa_id: NUMERO_DO_CLIENTE }],
              messages: [
                {
                  id: WAMID,
                  from: NUMERO_DO_CLIENTE,
                  timestamp: '1759100000',
                  type: 'text',
                  text: { body: 'oi' },
                },
              ],
            },
          },
        ],
      },
    ],
  })
  const assinatura = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
  return useCase.execute({ companyId: COMPANY_ID, rawBody, signatureHeader: assinatura })
}

describe('recusa determinística da Meta ao reagir ao webhook', () => {
  it('não derruba a entrega — a Meta recebe sucesso e não reentrega', async () => {
    const resultado = await entregarMensagem(createUseCase(TOKEN_SEM_ESCOPO))

    expect(resultado.messagesProcessed).toBe(1)
    expect(resultado.duplicate).toBe(false)
  })

  it('avisa o host, porque a resposta ao cliente se perdeu', async () => {
    const { useCase, recusas } = createUseCaseComCaptura(TOKEN_SEM_ESCOPO)

    await entregarMensagem(useCase)

    expect(recusas).toHaveLength(1)
    expect(recusas[0]?.kind).toBe('message')
    expect(recusas[0]?.code).toBe('200')
    expect(recusas[0]?.companyId).toBe(COMPANY_ID)
    expect(recusas[0]?.whatsappNumber).toBe(NUMERO_DO_CLIENTE)
  })

  it('falha de rede continua subindo: essa a reentrega da Meta resolve', async () => {
    const { useCase, recusas } = createUseCaseComCaptura(new WhatsAppConnectionError('ECONNRESET'))

    await expect(entregarMensagem(useCase)).rejects.toThrow(WhatsAppConnectionError)
    expect(recusas).toHaveLength(0)
  })

  it('erro que não é da Graph API continua subindo — não é nosso julgamento', async () => {
    const { useCase, recusas } = createUseCaseComCaptura(new Error('banco caiu'))

    await expect(entregarMensagem(useCase)).rejects.toThrow('banco caiu')
    expect(recusas).toHaveLength(0)
  })

  it('host sem o hook implementado também não derruba o webhook', async () => {
    const semHook = createUseCase(TOKEN_SEM_ESCOPO)

    expect((await entregarMensagem(semHook)).messagesProcessed).toBe(1)
  })
})
