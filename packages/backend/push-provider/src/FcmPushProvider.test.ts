/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `messagingClient` injetado em todo teste — o `firebase-admin` real nunca é carregado aqui, e
 * cada driver precisa de credencial e rede que este pacote não deve exigir para rodar sua suíte.
 */

import { describe, expect, it } from 'bun:test'

import { createFcmPushProvider } from './FcmPushProvider'
import type { FcmMessage, FcmMessagingClient } from './FcmMessagingClient'

function fakeClient(send: FcmMessagingClient['send']): FcmMessagingClient {
  return { send }
}

describe('createFcmPushProvider', () => {
  it('envia e devolve o id de mensagem do provedor', async () => {
    const provider = createFcmPushProvider({
      messagingClient: fakeClient(async () => 'projects/x/messages/1'),
    })

    const result = await provider.send({ token: 'fcm-token', platform: 'android', title: 'Oi', body: 'Teste' })

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'projects/x/messages/1' })
  })

  it('monta bloco webpush para destino web', async () => {
    let sentMessage: FcmMessage | undefined
    const provider = createFcmPushProvider({
      messagingClient: fakeClient(async (message) => {
        sentMessage = message
        return 'id'
      }),
    })

    await provider.send({ token: 'web-token', platform: 'web', title: 'Oi', body: 'Teste' })

    expect(sentMessage?.webpush?.notification?.title).toBe('Oi')
    expect(sentMessage?.android).toBeUndefined()
    expect(sentMessage?.apns).toBeUndefined()
  })

  it('monta apns.payload.aps.badge para destino iOS', async () => {
    let sentMessage: FcmMessage | undefined
    const provider = createFcmPushProvider({
      messagingClient: fakeClient(async (message) => {
        sentMessage = message
        return 'id'
      }),
    })

    await provider.send({ token: 'ios-token', platform: 'ios', title: 'Oi', body: 'Teste', badge: 3 })

    expect(sentMessage?.apns?.payload.aps.badge).toBe(3)
  })

  it('classifica token não registrado como invalid_target', async () => {
    const provider = createFcmPushProvider({
      messagingClient: fakeClient(async () => {
        throw { code: 'messaging/registration-token-not-registered', message: 'gone' }
      }),
    })

    const result = await provider.send({ token: 'dead-token', platform: 'android', title: 'Oi', body: 'Teste' })

    expect(result).toEqual({ outcome: 'invalid_target', errorCode: 'messaging/registration-token-not-registered' })
  })

  it('classifica quota excedida como retriable e argumento inválido como permanent', async () => {
    const quotaProvider = createFcmPushProvider({
      messagingClient: fakeClient(async () => {
        throw { code: 'messaging/quota-exceeded', message: 'slow down' }
      }),
    })
    const invalidArgProvider = createFcmPushProvider({
      messagingClient: fakeClient(async () => {
        throw { code: 'messaging/invalid-argument', message: 'bad payload' }
      }),
    })

    const retriable = await quotaProvider.send({ token: 't', platform: 'android', title: 'Oi', body: 'Teste' })
    const permanent = await invalidArgProvider.send({ token: 't', platform: 'android', title: 'Oi', body: 'Teste' })

    expect(retriable.outcome).toBe('retriable')
    expect(permanent.outcome).toBe('permanent')
  })

  it('classifica erro sem código reconhecido como retriable', async () => {
    const provider = createFcmPushProvider({
      messagingClient: fakeClient(async () => {
        throw new Error('network blip')
      }),
    })

    const result = await provider.send({ token: 't', platform: 'android', title: 'Oi', body: 'Teste' })

    expect(result.outcome).toBe('retriable')
  })

  it('sem messagingClient e sem serviceAccountJson, falha no boot em vez de na primeira notificação', async () => {
    const provider = createFcmPushProvider({})

    await expect(provider.send({ token: 't', platform: 'android', title: 'Oi', body: 'Teste' })).rejects.toThrow()
  })
})
