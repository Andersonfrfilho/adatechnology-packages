/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Mesma guarda do `meta-whatsapp-contracts`: sem `strict` na emissão, a inferência do zod degrada
 * e TODO campo obrigatório vira opcional no .d.ts publicado (`body?: string` para um
 * `z.ZodString`), quebrando qualquer consumidor strict. Foi o que impediu o QuickCart de compilar
 * contra a 0.2.0-rc.1 daquele pacote.
 *
 * O teste não roda o compilador: afirma em nível de tipo que os obrigatórios não aceitam
 * `undefined`. Se as declarações voltarem a sair sem strict, estas asserções param de compilar no
 * `check` do pacote.
 */

import { describe, expect, it } from 'bun:test'

import { createWhatsAppDriverFromChannel } from './whatsappDriver'
import { listNotificationsQuerySchema, sendNotificationSchema, type SendNotificationBody } from './schemas'
import type { DeliveryAttemptResult } from './channelDrivers'

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function assertExact<T extends true>(): void {
  void 0 as unknown as T
}

describe('declarações do contracts sob strict', () => {
  it('mantém campos obrigatórios sem undefined', () => {
    assertExact<Exact<SendNotificationBody['recipientUserId'], string>>()
    assertExact<Exact<SendNotificationBody['category'], string>>()
    assertExact<Exact<SendNotificationBody['templateKey'], string>>()

    expect(true).toBe(true)
  })

  it('não aceita companyId no corpo — tenant vem do contexto autenticado', () => {
    const parsed = sendNotificationSchema.parse({
      recipientUserId: '3f6a1b7e-27bb-4a53-9a41-1d1b0f4a51cd',
      category: 'order_status',
      templateKey: 'order.out_for_delivery',
      companyId: 'tentativa-de-injecao',
    })

    expect('companyId' in parsed).toBe(false)
  })

  it('aplica o teto de perPage da paginação', () => {
    expect(listNotificationsQuerySchema.parse({}).perPage).toBe(20)
    expect(listNotificationsQuerySchema.safeParse({ perPage: '500' }).success).toBe(false)
  })
})

describe('createWhatsAppDriverFromChannel', () => {
  const okChannel = {
    sendText: async () => ({ externalMessageId: 'wamid.1' }),
    sendTemplate: async () => ({ externalMessageId: 'wamid.2' }),
  }

  it('usa sendTemplate quando há template e sendText quando não há', async () => {
    const calls: string[] = []
    const driver = createWhatsAppDriverFromChannel({
      sendText: async () => {
        calls.push('text')
        return { externalMessageId: 'wamid.1' }
      },
      sendTemplate: async () => {
        calls.push('template')
        return { externalMessageId: 'wamid.2' }
      },
    })

    await driver.send({ to: '5511999999999', body: 'oi' })
    await driver.send({
      to: '5511999999999',
      body: 'oi',
      template: { templateName: 'order_update', languageCode: 'pt_BR' },
    })

    expect(calls).toEqual(['text', 'template'])
  })

  it('devolve sent com o id do provedor', async () => {
    const result = await createWhatsAppDriverFromChannel(okChannel).send({ to: '5511999999999', body: 'oi' })

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'wamid.1' } satisfies DeliveryAttemptResult)
  })

  it('classifica número inexistente como invalid_target, sem retry', async () => {
    const driver = createWhatsAppDriverFromChannel({
      ...okChannel,
      sendText: async () => {
        throw Object.assign(new Error('undeliverable'), { code: 131026 })
      },
    })

    expect((await driver.send({ to: '5511999999999', body: 'oi' })).outcome).toBe('invalid_target')
  })

  it('classifica janela de 24h como permanente e rate limit como retriável', async () => {
    const windowExpired = createWhatsAppDriverFromChannel({
      ...okChannel,
      sendText: async () => {
        throw Object.assign(new Error('re-engagement'), { code: 131047 })
      },
    })
    const rateLimited = createWhatsAppDriverFromChannel({
      ...okChannel,
      sendText: async () => {
        throw Object.assign(new Error('rate limit'), { statusCode: 429 })
      },
    })

    expect((await windowExpired.send({ to: '5511999999999', body: 'oi' })).outcome).toBe('permanent')
    expect((await rateLimited.send({ to: '5511999999999', body: 'oi' })).outcome).toBe('retriable')
  })
})
