/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createNotificationClient, type NotificationApiError } from './httpClient'
import { createDeviceRegistration, type DeviceRegistrationStorage } from './deviceRegistration'

type CapturedRequest = { url: string; method: string; headers: Record<string, string>; body?: string }

function buildClient(handler: (request: CapturedRequest) => Response) {
  const captured: CapturedRequest[] = []
  const client = createNotificationClient({
    baseUrl: 'https://api.exemplo.com/v1',
    getAuthHeaders: () => ({ authorization: 'Bearer token-do-host' }),
    fetchImpl: (async (url: string, init?: RequestInit) => {
      const request = {
        url,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body as string | undefined,
      }
      captured.push(request)
      return handler(request)
    }) as unknown as typeof fetch,
  })
  return { client, captured }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('createNotificationClient', () => {
  it('restoreDefault faz POST em /restore-default e devolve o modelo', async () => {
    const template = { id: 'tpl 1', key: 'notification.standard-email', version: 4 }
    const { client, captured } = buildClient(() => jsonResponse(201, { data: template }))

    const restored = await client.restoreDefault('tpl 1')

    expect(captured[0]?.method).toBe('POST')
    expect(captured[0]?.url).toBe('https://api.exemplo.com/v1/notification-templates/tpl%201/restore-default')
    expect(captured[0]?.body).toBeUndefined()
    expect(restored).toEqual(template as never)
  })

  it('restoreDefault propaga 409 (modelo obrigatório) com o código do servidor', async () => {
    const { client } = buildClient(() =>
      jsonResponse(409, { error: { code: 'STANDARD_EMAIL_TEMPLATE_REQUIRED', message: 'obrigatório' } }),
    )

    const error = (await client.restoreDefault('x').catch((e: unknown) => e)) as NotificationApiError
    expect(error.status).toBe(409)
    expect(error.code).toBe('STANDARD_EMAIL_TEMPLATE_REQUIRED')
  })

  it('monta query string só com os filtros informados', async () => {
    const { client, captured } = buildClient(() =>
      jsonResponse(200, { data: [], pagination: {}, meta: { unreadCount: 0 } }),
    )

    await client.listNotifications({ read: false, perPage: 20 })

    const url = new URL(captured[0]?.url ?? '')
    expect(url.searchParams.get('read')).toBe('false')
    expect(url.searchParams.get('perPage')).toBe('20')
    expect(url.searchParams.has('category')).toBe(false)
  })

  it('suporta baseUrl relativa sem estourar TypeError de URL invalida', async () => {
    const captured: { url: string }[] = []
    const client = createNotificationClient({
      baseUrl: '/v1/panel',
      fetchImpl: (async (input: string) => {
        captured.push({ url: String(input) })
        return jsonResponse(200, { data: [] })
      }) as unknown as typeof fetch,
    })

    const templates = await client.listTemplates()
    expect(templates).toEqual([])
    expect(captured[0]?.url).toBe('/v1/panel/notification-templates')
  })

  it('resolve o header de autorização a cada chamada, não uma vez no boot', async () => {
    let tokenVersion = 0
    const client = createNotificationClient({
      baseUrl: 'https://api.exemplo.com/v1',
      getAuthHeaders: () => ({ authorization: `Bearer token-${++tokenVersion}` }),
      fetchImpl: (async () => jsonResponse(200, { data: { unreadCount: 0 } })) as unknown as typeof fetch,
    })

    await client.countUnread()
    await client.countUnread()

    // Token rotativo é o caso normal do host; capturar no boot deixaria o cliente com credencial
    // vencida depois do primeiro refresh.
    expect(tokenVersion).toBe(2)
  })

  it('trata 204 como sucesso sem corpo', async () => {
    const { client } = buildClient(() => new Response(null, { status: 204 }))

    await expect(client.deleteNotification('abc')).resolves.toBeUndefined()
  })

  it('converte envelope de erro em NotificationApiError com código e issues', async () => {
    const { client } = buildClient(() =>
      jsonResponse(400, {
        error: {
          code: 'NOTIFICATION_VALIDATION_ERROR',
          message: 'Requisição inválida.',
          issues: [{ path: 'name', message: 'obrigatório' }],
        },
      }),
    )

    const error = (await client.markAllAsRead().catch((caught: unknown) => caught)) as NotificationApiError

    expect(error.status).toBe(400)
    expect(error.code).toBe('NOTIFICATION_VALIDATION_ERROR')
    expect(error.issues).toHaveLength(1)
  })

  it('escapa o id na URL — id com barra não escapa para outra rota', async () => {
    const { client, captured } = buildClient(() => new Response(null, { status: 204 }))

    await client.deleteNotification('abc/../../admin')

    expect(captured[0]?.url).toContain('abc%2F..%2F..%2Fadmin')
  })

  it('getVapidPublicKey busca em /push/vapid-public-key e devolve a chave', async () => {
    const { client, captured } = buildClient(() => jsonResponse(200, { data: { publicKey: 'vapid-pubkey-123' } }))

    const key = await client.getVapidPublicKey()

    expect(captured[0]?.method).toBe('GET')
    expect(captured[0]?.url).toBe('https://api.exemplo.com/v1/push/vapid-public-key')
    expect(key).toBe('vapid-pubkey-123')
  })

  it('sendPush envia payload direto para /push/send', async () => {
    const sendResult = { success: true, messageId: 'msg-1', outcome: { outcome: 'sent' as const } }
    const { client, captured } = buildClient(() => jsonResponse(200, { data: sendResult }))

    const result = await client.sendPush({
      target: { type: 'user', userId: 'user-1' },
      notification: { title: 'Título', body: 'Corpo' },
    })

    expect(captured[0]?.method).toBe('POST')
    expect(captured[0]?.url).toBe('https://api.exemplo.com/v1/push/send')
    expect(JSON.parse(captured[0]?.body ?? '{}').notification.title).toBe('Título')
    expect(result.success).toBe(true)
  })

  it('broadcastPush envia payload para /push/broadcast', async () => {
    const broadcastResult = { sentCount: 10, failedCount: 0, invalidTargetsRemoved: 1 }
    const { client, captured } = buildClient(() => jsonResponse(200, { data: broadcastResult }))

    const result = await client.broadcastPush({
      filter: { topic: 'news' },
      notification: { title: 'Novidade', body: 'Confira' },
    })

    expect(captured[0]?.method).toBe('POST')
    expect(captured[0]?.url).toBe('https://api.exemplo.com/v1/push/broadcast')
    expect(result.sentCount).toBe(10)
  })

  it('registerWebPush cadastra device com driver webpush e token serializado', async () => {
    const mockDevice = { id: 'dev-web-1', platform: 'web', driver: 'webpush', lastSeenAt: '2026-11-11' }
    const { client, captured } = buildClient(() => jsonResponse(201, { data: mockDevice }))

    const sub = {
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz',
      keys: { p256dh: 'p256', auth: 'auth' },
    }

    const device = await client.registerWebPush(sub, { locale: 'pt-BR' })

    expect(captured[0]?.method).toBe('POST')
    expect(captured[0]?.url).toBe('https://api.exemplo.com/v1/notification-devices')
    const body = JSON.parse(captured[0]?.body ?? '{}')
    expect(body.driver).toBe('webpush')
    expect(body.platform).toBe('web')
    expect(JSON.parse(body.token).endpoint).toBe(sub.endpoint)
    expect(device.id).toBe('dev-web-1')
  })
})

describe('createDeviceRegistration', () => {
  function buildStorage(): DeviceRegistrationStorage & { store: Map<string, string> } {
    const store = new Map<string, string>()
    return {
      store,
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value)
      },
      removeItem: (key) => {
        store.delete(key)
      },
    }
  }

  it('não registra nada quando a permissão foi negada — e isso não é erro', async () => {
    const { client, captured } = buildClient(() => jsonResponse(201, { data: { id: 'device-1' } }))
    const registration = createDeviceRegistration({ client, driver: 'expo', getToken: async () => undefined })

    const device = await registration.register({ platform: 'android' })

    expect(device).toBeUndefined()
    expect(captured).toHaveLength(0)
  })

  it('registra e guarda o id para o logout conseguir remover o device certo', async () => {
    const storage = buildStorage()
    const { client, captured } = buildClient((request) =>
      request.method === 'POST' ? jsonResponse(201, { data: { id: 'device-1' } }) : new Response(null, { status: 204 }),
    )
    const registration = createDeviceRegistration({
      client,
      driver: 'fcm',
      storage,
      getToken: async () => 'token-do-aparelho',
    })

    await registration.register({ platform: 'web', appVersion: '1.2.3' })
    expect(JSON.parse(captured[0]?.body ?? '{}')).toMatchObject({
      driver: 'fcm',
      platform: 'web',
      token: 'token-do-aparelho',
    })

    await registration.unregister()
    expect(captured[1]?.method).toBe('DELETE')
    expect(captured[1]?.url).toContain('device-1')
    expect(storage.store.size).toBe(0)
  })

  it('unregister sem device guardado não chama a API', async () => {
    const { client, captured } = buildClient(() => new Response(null, { status: 204 }))
    const registration = createDeviceRegistration({
      client,
      driver: 'expo',
      storage: buildStorage(),
      getToken: async () => 'token',
    })

    await registration.unregister()

    expect(captured).toHaveLength(0)
  })
})
