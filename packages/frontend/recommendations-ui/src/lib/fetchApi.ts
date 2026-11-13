/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cliente HTTP padrão para as rotas do `recommendation-module`.
 */

import type { RecommendationsApi } from '../providers/types'

export class RecommendationsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'RecommendationsApiError'
  }
}

export type CreateFetchRecommendationsApiParams = {
  /** Onde as rotas foram montadas, sem barra no fim: `https://api.exemplo.com/v1`. */
  readonly baseUrl: string
  /** Padrão: `include`, para a sessão por cookie do host ir junto. */
  readonly credentials?: RequestCredentials
  /** Cabeçalhos extras por chamada (ex.: `Authorization`). */
  readonly headers?: () => Record<string, string> | Promise<Record<string, string>>
  readonly fetch?: typeof fetch
}

function toQuery(params: Readonly<Record<string, unknown>>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function createFetchRecommendationsApi(params: CreateFetchRecommendationsApiParams): RecommendationsApi {
  const doFetch = params.fetch ?? fetch

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const extra = params.headers ? await params.headers() : {}
    const response = await doFetch(`${params.baseUrl}${path}`, {
      method,
      credentials: params.credentials ?? 'include',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

    if (response.status === 204) return undefined as T
    const payload = (await response.json().catch(() => undefined)) as
      { data?: unknown; error?: { code?: string; message?: string } } | undefined

    if (!response.ok) {
      throw new RecommendationsApiError(
        payload?.error?.message ?? `Falha ${response.status}`,
        response.status,
        payload?.error?.code,
      )
    }
    return payload as T
  }

  const data = async <T>(promise: Promise<{ data: T }>): Promise<T> => (await promise).data

  return {
    getFeed: (query) => data(request('GET', `/recommendations${toQuery(query)}`)),
    trackEvent: (event) => request('POST', '/recommendations/events', event),
    getSettings: () => data(request('GET', '/recommendation-settings')),
    listItems: (query) => request('GET', `/recommendation-items${toQuery(query)}`),
    getItem: (id) => data(request('GET', `/recommendation-items/${encodeURIComponent(id)}`)),
    createItem: (input) => data(request('POST', '/recommendation-items', input)),
    updateItem: (id, input) => data(request('PATCH', `/recommendation-items/${encodeURIComponent(id)}`, input)),
    createCampaign: (itemId, input) =>
      data(request('POST', `/recommendation-items/${encodeURIComponent(itemId)}/campaigns`, input)),
    updateCampaign: (id, input) => data(request('PATCH', `/recommendation-campaigns/${encodeURIComponent(id)}`, input)),
    getStats: (query) => data(request('GET', `/recommendation-stats${toQuery(query)}`)),
  }
}
