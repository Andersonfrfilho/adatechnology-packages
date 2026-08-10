/**
 * Uma WABA comporta vários números, e a inscrição de webhook da Meta é por WABA — todo app inscrito
 * recebe os eventos de todos os números da conta. Sem filtro, duas instâncias que compartilham a
 * conta respondem os clientes uma da outra e cruzam contatos nas bases. Aconteceu em produção; estes
 * testes existem para não acontecer de novo.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type { SessionState } from '@adatechnology/meta-whatsapp-contracts'
import { buildInboundTextPayload, serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import { ReceiveWebhookUseCase } from './ReceiveWebhook.use-case'
import type { NonceStoreInterface } from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'
const NOSSO_NUMERO = '1129051206965973'
const NUMERO_VIZINHO = '1179556508579559'
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

function createUseCase(): { useCase: ReceiveWebhookUseCase; readonly gravadas: string[] } {
  const gravadas: string[] = []

  const logMessage = {
    // `null` = mensagem já gravada. Encerra `handleMessage` cedo e mantém o teste focado no filtro.
    async execute(params: { whatsappNumber: string }): Promise<null> {
      gravadas.push(params.whatsappNumber)
      return null
    },
  } as unknown as LogMessageUseCase

  const useCase = new ReceiveWebhookUseCase({
    appSecret: APP_SECRET,
    phoneNumberId: NOSSO_NUMERO,
    nonceStore: createNonceStore(),
    sessionRepository: {} as unknown as SessionRepository,
    messageRepository: {} as unknown as MessageRepository,
    logMessage,
    startState: 'inicio' as SessionState,
  })

  return { useCase, gravadas }
}

function entregar(useCase: ReceiveWebhookUseCase, rawBody: string) {
  return useCase.execute({
    companyId: COMPANY_ID,
    rawBody,
    signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
  })
}

describe('ReceiveWebhookUseCase — isolamento por número', () => {
  it('ignora mensagem endereçada a outro número da mesma WABA', async () => {
    const { useCase, gravadas } = createUseCase()
    const rawBody = serializeWebhookPayload(
      buildInboundTextPayload({ from: '5516999999999', phoneNumberId: NUMERO_VIZINHO, text: 'ola' }),
    )

    const result = await entregar(useCase, rawBody)

    expect(result.messagesProcessed).toBe(0)
    expect(result.ignoredForeignNumber).toBe(1)
    // O que de fato importa: o contato do cliente alheio não encostou na nossa base.
    expect(gravadas).toEqual([])
  })

  it('processa mensagem do próprio número', async () => {
    const { useCase, gravadas } = createUseCase()
    const rawBody = serializeWebhookPayload(
      buildInboundTextPayload({ from: '5516999999999', phoneNumberId: NOSSO_NUMERO, text: 'ola' }),
    )

    const result = await entregar(useCase, rawBody)

    expect(result.messagesProcessed).toBe(1)
    expect(result.ignoredForeignNumber).toBe(0)
    expect(gravadas).toEqual(['5516999999999'])
  })

  it('processa quando a Meta não manda metadata, por não haver como decidir pertencimento', async () => {
    const { useCase, gravadas } = createUseCase()
    const payload = buildInboundTextPayload({ from: '5516999999999', phoneNumberId: NOSSO_NUMERO, text: 'ola' })
    // Pelo JSON, não pelo objeto tipado: `metadata` é obrigatório no contrato, e o caso a cobrir é
    // justamente a entrega que chega sem ele.
    const semMetadata = JSON.parse(serializeWebhookPayload(payload)) as {
      entry: { changes: { value: { metadata?: unknown } }[] }[]
    }
    for (const entry of semMetadata.entry) {
      for (const change of entry.changes) delete change.value.metadata
    }

    const result = await entregar(useCase, JSON.stringify(semMetadata))

    expect(result.messagesProcessed).toBe(1)
    expect(result.ignoredForeignNumber).toBe(0)
    expect(gravadas).toEqual(['5516999999999'])
  })
})
