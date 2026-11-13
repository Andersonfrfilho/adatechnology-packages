/**
 * Eventos de nível WABA (`message_template_status_update`, `phone_number_quality_update`) chegam na
 * MESMA rota das mensagens e sem `messaging_product`/`metadata`. Antes disto o schema exigia
 * `messaging_product` e o parse era `parse`: um evento de template derrubava a entrega inteira, e
 * um field sem handler era descartado sem deixar rastro — indistinguível de webhook mudo.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type {
  MetaWhatsAppHooks,
  SessionState,
  UnhandledWebhookEventDescriptor,
  WhatsAppPhoneNumberQualityUpdate,
  WhatsAppTemplateStatusUpdate,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const NOSSO_NUMERO = '1307146062476376'
const COMPANY_ID = '00000000-0000-4000-8000-000000000001'

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

type Capturas = {
  readonly templates: WhatsAppTemplateStatusUpdate[]
  readonly qualidades: WhatsAppPhoneNumberQualityUpdate[]
  readonly naoTratados: UnhandledWebhookEventDescriptor[]
}

function createUseCase(): { useCase: ReceiveWebhookUseCase; capturas: Capturas } {
  const capturas: Capturas = { templates: [], qualidades: [], naoTratados: [] }

  const hooks: MetaWhatsAppHooks = {
    onTemplateStatusUpdate: (update) => {
      capturas.templates.push(update)
    },
    onPhoneNumberQualityUpdate: (update) => {
      capturas.qualidades.push(update)
    },
    onUnhandledWebhookEvent: (details) => {
      capturas.naoTratados.push(details)
    },
  }

  const useCase = new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: NOSSO_NUMERO,
    nonceStore: createNonceStore(),
    sessionRepository: {} as unknown as SessionRepository,
    messageRepository: {} as unknown as MessageRepository,
    logMessage: {} as unknown as LogMessageUseCase,
    startState: 'inicio' as SessionState,
    hooks,
  })

  return { useCase, capturas }
}

function entregar(useCase: ReceiveWebhookUseCase, payload: unknown) {
  const rawBody = JSON.stringify(payload)
  const assinatura = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
  return useCase.execute({ companyId: COMPANY_ID, rawBody, signatureHeader: assinatura })
}

function envelope(field: string, value: unknown) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '1663369241611391', changes: [{ field, value }] }],
  }
}

describe('eventos de conta no webhook', () => {
  it('entrega aprovação de template ao hook do host', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregar(
      useCase,
      envelope('message_template_status_update', {
        event: 'APPROVED',
        message_template_id: 1234567890,
        message_template_name: 'retomada_financiamento',
        message_template_language: 'pt_BR',
      }),
    )

    expect(resultado.accountEventsProcessed).toBe(1)
    expect(resultado.unhandledEvents).toBe(0)
    expect(capturas.templates[0]?.event).toBe('APPROVED')
    expect(capturas.templates[0]?.message_template_name).toBe('retomada_financiamento')
    // A Meta manda o id como número aqui e como string em outros eventos; normalizamos na fronteira.
    expect(capturas.templates[0]?.message_template_id).toBe('1234567890')
  })

  it('entrega rejeição com o motivo, que é o que diz o que corrigir', async () => {
    const { useCase, capturas } = createUseCase()

    await entregar(
      useCase,
      envelope('message_template_status_update', {
        event: 'REJECTED',
        message_template_id: '999',
        message_template_name: 'promo_agressiva',
        message_template_language: 'pt_BR',
        reason: 'ABUSIVE_CONTENT',
      }),
    )

    expect(capturas.templates[0]?.reason).toBe('ABUSIVE_CONTENT')
  })

  it('entrega queda de qualidade do número ao hook do host', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregar(
      useCase,
      envelope('phone_number_quality_update', {
        display_phone_number: '5516991136514',
        event: 'FLAGGED',
        current_limit: 'TIER_1K',
      }),
    )

    expect(resultado.accountEventsProcessed).toBe(1)
    expect(capturas.qualidades[0]?.event).toBe('FLAGGED')
    expect(capturas.qualidades[0]?.current_limit).toBe('TIER_1K')
  })

  it('não descarta em silêncio um field sem handler', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregar(useCase, envelope('account_alerts', { some_new_meta_field: 'x' }))

    expect(resultado.unhandledEvents).toBe(1)
    expect(capturas.naoTratados[0]?.field).toBe('account_alerts')
    expect(capturas.naoTratados[0]?.reason).toBe('unknown-field')
  })

  it('reporta corpo fora do schema sem derrubar a entrega', async () => {
    const { useCase, capturas } = createUseCase()

    const resultado = await entregar(
      useCase,
      envelope('message_template_status_update', { event: 'ESTADO_QUE_NAO_EXISTE' }),
    )

    expect(resultado.unhandledEvents).toBe(1)
    expect(capturas.naoTratados[0]?.reason).toBe('invalid-shape')
    expect(capturas.templates).toHaveLength(0)
  })

  it('evento de conta não derruba a mensagem de cliente que vem no mesmo payload', async () => {
    const { useCase, capturas } = createUseCase()
    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1663369241611391',
          changes: [
            {
              field: 'message_template_status_update',
              value: {
                event: 'PAUSED',
                message_template_id: '1',
                message_template_name: 'x',
                message_template_language: 'pt_BR',
              },
            },
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '5516991136514', phone_number_id: NOSSO_NUMERO },
                statuses: [{ id: 'wamid.abc', status: 'delivered', timestamp: '1700000000' }],
              },
            },
          ],
        },
      ],
    })
    const assinatura = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`

    // `updateMessageStatus` devolvendo null encerra handleStatus cedo e mantém o teste no roteamento.
    const semMensagem = {
      async updateMessageStatus() {
        return null
      },
    } as unknown as MessageRepository
    const useCaseComRepo = new ReceiveWebhookUseCase({
      appSecret: APP_SECRET,
      phoneNumberId: NOSSO_NUMERO,
      nonceStore: createNonceStore(),
      sessionRepository: {} as unknown as SessionRepository,
      messageRepository: semMensagem,
      logMessage: {} as unknown as LogMessageUseCase,
      startState: 'inicio' as SessionState,
      hooks: {
        onTemplateStatusUpdate: (update) => {
          capturas.templates.push(update)
        },
      },
    })

    const resultado = await useCaseComRepo.execute({ companyId: COMPANY_ID, rawBody, signatureHeader: assinatura })

    expect(resultado.accountEventsProcessed).toBe(1)
    expect(resultado.statusesProcessed).toBe(1)
    expect(capturas.templates[0]?.event).toBe('PAUSED')
    void useCase
  })
})
