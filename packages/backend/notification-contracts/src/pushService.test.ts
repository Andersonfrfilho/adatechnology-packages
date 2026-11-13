/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  broadcastPushSchema,
  registerPushSubscriptionSchema,
  sendPushDirectSchema,
  webPushSubscriptionSchema,
} from './schemas'

describe('pushService schemas', () => {
  const validSubscription = {
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB...',
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9tWVHRZ6w0o4VNf55J15D34q7EHoOx6mdEDGDeVelRGCdg',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  }

  it('valida webPushSubscriptionSchema', () => {
    const parsed = webPushSubscriptionSchema.parse(validSubscription)
    expect(parsed.endpoint).toBe(validSubscription.endpoint)
    expect(parsed.keys.p256dh).toBe(validSubscription.keys.p256dh)
    expect(parsed.keys.auth).toBe(validSubscription.keys.auth)
  })

  it('recusa endpoint que não é URL válida', () => {
    expect(() =>
      webPushSubscriptionSchema.parse({
        endpoint: 'not-a-url',
        keys: validSubscription.keys,
      }),
    ).toThrow()
  })

  it('valida sendPushDirectSchema com target subscription', () => {
    const input = {
      target: {
        type: 'subscription',
        subscription: validSubscription,
      },
      notification: {
        title: 'Novo pedido',
        body: 'Seu pedido #123 foi recebido',
        url: '/orders/123',
      },
    }
    const parsed = sendPushDirectSchema.parse(input)
    expect(parsed.target.type).toBe('subscription')
    expect(parsed.notification.title).toBe('Novo pedido')
  })

  it('valida sendPushDirectSchema com target token', () => {
    const input = {
      target: {
        type: 'token',
        token: 'ExponentPushToken[xxxxxx]',
        platform: 'android',
        driver: 'expo',
      },
      notification: {
        title: 'Atualização',
        body: 'Pedido enviado',
      },
    }
    const parsed = sendPushDirectSchema.parse(input)
    expect(parsed.target.type).toBe('token')
  })

  it('valida broadcastPushSchema', () => {
    const input = {
      filter: {
        topic: 'promotions',
        platform: 'web',
      },
      notification: {
        title: 'Black Friday',
        body: 'Aproveite até 50% de desconto!',
      },
    }
    const parsed = broadcastPushSchema.parse(input)
    expect(parsed.filter?.topic).toBe('promotions')
  })

  it('garante invariante: companyId não é aceito no corpo do sendPushDirectSchema', () => {
    const parsed = sendPushDirectSchema.parse({
      target: {
        type: 'user',
        userId: 'user-123',
      },
      notification: {
        title: 'Aviso',
        body: 'Corpo',
      },
      companyId: 'tentativa-de-injecao',
    } as unknown)

    expect('companyId' in (parsed as Record<string, unknown>)).toBe(false)
  })

  it('valida registerPushSubscriptionSchema', () => {
    const input = {
      platform: 'web',
      driver: 'webpush',
      subscription: validSubscription,
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    }
    const parsed = registerPushSubscriptionSchema.parse(input)
    expect(parsed.platform).toBe('web')
    expect(parsed.driver).toBe('webpush')
  })
})
