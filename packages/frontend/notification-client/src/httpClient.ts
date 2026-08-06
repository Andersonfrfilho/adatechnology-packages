/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cliente HTTP tipado pelas 13 rotas do módulo. **Isomórfico e sem DOM**: `fetch` é injetável e o
 * default é o global — é o que permite o mesmo pacote rodar no React Native do cawme e no PWA do
 * quickcart, sem o `-ui` (que tem `react-dom` e Tailwind) entrar no bundle mobile.
 */

import type {
  DeviceRegistration,
  NotificationPreference,
  NotificationSummary,
  NotificationTemplate,
  UpsertTemplateBody,
} from '@adatechnology/notification-contracts'

export type NotificationClientConfig = {
  /** Base do host, sem barra final: `https://api.exemplo.com/v1`. */
  readonly baseUrl: string
  /**
   * Devolve o header de autorização a cada chamada — função, não string, porque o token do host
   * rotaciona e capturar o valor no boot deixaria o cliente com uma credencial vencida.
   */
  readonly getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>
  readonly fetchImpl?: typeof fetch
}

export type ListNotificationsOptions = {
  readonly category?: string
  readonly read?: boolean
  readonly cursor?: string
  readonly perPage?: number
}

export type ListNotificationsPage = {
  readonly data: readonly NotificationSummary[]
  readonly nextCursor?: string
  readonly unreadCount: number
}

export type RegisterDeviceInput = {
  readonly platform: 'ios' | 'android' | 'web'
  readonly driver: 'expo' | 'fcm'
  readonly token: string
  readonly appVersion?: string
  readonly locale?: string
  readonly timezone?: string
}

export type NotificationApiError = Error & {
  readonly status: number
  readonly code: string
  readonly issues?: readonly { path: string; message: string }[]
}

function buildApiError(status: number, payload: unknown): NotificationApiError {
  const envelope = payload as {
    error?: { code?: string; message?: string; issues?: { path: string; message: string }[] }
  }
  const error = new Error(envelope?.error?.message ?? `Falha na requisição (${status}).`) as NotificationApiError
  return Object.assign(error, {
    status,
    code: envelope?.error?.code ?? 'NOTIFICATION_UNKNOWN_ERROR',
    issues: envelope?.error?.issues,
  })
}

export type NotificationClient = {
  listNotifications(options?: ListNotificationsOptions): Promise<ListNotificationsPage>
  countUnread(): Promise<number>
  markAsRead(id: string): Promise<NotificationSummary>
  markAllAsRead(): Promise<number>
  deleteNotification(id: string): Promise<void>
  registerDevice(input: RegisterDeviceInput): Promise<DeviceRegistration>
  unregisterDevice(id: string): Promise<void>
  getPreferences(): Promise<readonly NotificationPreference[]>
  updatePreferences(preferences: readonly NotificationPreference[]): Promise<readonly NotificationPreference[]>
  listTemplates(): Promise<readonly NotificationTemplate[]>
  /**
   * Cria uma VERSÃO nova do template, não edita a atual.
   *
   * O módulo versiona por `key`+`channel`+`locale`: a versão anterior fica legível para auditoria, e
   * a leitura só devolve a ativa mais alta. Então "editar a copy" e "reverter" são a mesma operação
   * — o que a tela de configuração precisa para alguém corrigir um texto sem medo.
   */
  upsertTemplate(input: UpsertTemplateBody): Promise<NotificationTemplate>
  /** Base + headers, para o assinante de SSE reaproveitar a mesma configuração. */
  resolveStreamRequest(): Promise<{ url: string; headers: Record<string, string> }>
}

export function createNotificationClient(config: NotificationClientConfig): NotificationClient {
  const fetchImpl = config.fetchImpl ?? fetch
  const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl

  async function request<TResponse>(params: {
    method: string
    path: string
    query?: Record<string, string | number | boolean | undefined>
    body?: unknown
  }): Promise<TResponse | undefined> {
    const url = new URL(`${baseUrl}${params.path}`)
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const authHeaders = (await config.getAuthHeaders?.()) ?? {}
    const response = await fetchImpl(url.toString(), {
      method: params.method,
      headers: { ...(params.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...authHeaders },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
    })

    if (response.status === 204) return undefined

    const text = await response.text()
    const payload: unknown = text === '' ? undefined : JSON.parse(text)
    if (!response.ok) throw buildApiError(response.status, payload)
    return payload as TResponse
  }

  return {
    async listNotifications(options): Promise<ListNotificationsPage> {
      const payload = await request<{
        data: NotificationSummary[]
        pagination: { nextCursor?: string }
        meta: { unreadCount: number }
      }>({
        method: 'GET',
        path: '/notifications',
        query: { category: options?.category, read: options?.read, cursor: options?.cursor, perPage: options?.perPage },
      })

      return {
        data: payload?.data ?? [],
        nextCursor: payload?.pagination.nextCursor,
        unreadCount: payload?.meta.unreadCount ?? 0,
      }
    },

    async countUnread(): Promise<number> {
      const payload = await request<{ data: { unreadCount: number } }>({
        method: 'GET',
        path: '/notifications/unread-count',
      })
      return payload?.data.unreadCount ?? 0
    },

    async markAsRead(id): Promise<NotificationSummary> {
      const payload = await request<{ data: NotificationSummary }>({
        method: 'PATCH',
        path: `/notifications/${encodeURIComponent(id)}/read`,
      })
      if (!payload) throw new Error('notification-client: resposta vazia em markAsRead')
      return payload.data
    },

    async markAllAsRead(): Promise<number> {
      const payload = await request<{ data: { updated: number } }>({ method: 'POST', path: '/notifications/read-all' })
      return payload?.data.updated ?? 0
    },

    async deleteNotification(id): Promise<void> {
      await request({ method: 'DELETE', path: `/notifications/${encodeURIComponent(id)}` })
    },

    async registerDevice(input): Promise<DeviceRegistration> {
      const payload = await request<{ data: DeviceRegistration }>({
        method: 'POST',
        path: '/notification-devices',
        body: input,
      })
      if (!payload) throw new Error('notification-client: resposta vazia em registerDevice')
      return payload.data
    },

    async unregisterDevice(id): Promise<void> {
      await request({ method: 'DELETE', path: `/notification-devices/${encodeURIComponent(id)}` })
    },

    async getPreferences(): Promise<readonly NotificationPreference[]> {
      const payload = await request<{ data: NotificationPreference[] }>({
        method: 'GET',
        path: '/notification-preferences',
      })
      return payload?.data ?? []
    },

    async updatePreferences(preferences): Promise<readonly NotificationPreference[]> {
      const payload = await request<{ data: NotificationPreference[] }>({
        method: 'PUT',
        path: '/notification-preferences',
        body: { preferences },
      })
      return payload?.data ?? []
    },

    async listTemplates(): Promise<readonly NotificationTemplate[]> {
      const payload = await request<{ data: NotificationTemplate[] }>({
        method: 'GET',
        path: '/notification-templates',
      })
      return payload?.data ?? []
    },

    async upsertTemplate(input: UpsertTemplateBody): Promise<NotificationTemplate> {
      const payload = await request<{ data: NotificationTemplate }>({
        method: 'POST',
        path: '/notification-templates',
        body: input,
      })
      // Sem fallback: a rota responde 201 com o template criado, e devolver `undefined as never`
      // aqui esconderia uma mudança de contrato até estourar na tela.
      if (!payload?.data) throw new Error('notification-client: upsertTemplate não devolveu o template')
      return payload.data
    },

    async resolveStreamRequest(): Promise<{ url: string; headers: Record<string, string> }> {
      return { url: `${baseUrl}/notifications/stream`, headers: (await config.getAuthHeaders?.()) ?? {} }
    },
  }
}
