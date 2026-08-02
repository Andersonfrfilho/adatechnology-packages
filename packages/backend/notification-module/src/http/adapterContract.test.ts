/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste de contrato compartilhado (T5.5): a MESMA bateria roda contra os dois adaptadores e
 * exige status, envelope e corpo idênticos. É o que impede `fetch` e `uws` de divergirem — sem
 * ele, uma correção feita num adaptador silenciosamente não vale no outro, e o produto que usa o
 * template uWS herda um comportamento diferente do que o quickcart validou.
 */

import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import type { AuthContextResolverPort, NotificationRoute } from '@adatechnology/notification-contracts'

import { createNotificationFetchRouter } from './fetch'
import { mountNotificationRoutes, type UwsApp, type UwsRequest, type UwsResponse } from './uws'

const COMPANY_ID = '3f6a1b7e-27bb-4a53-9a41-1d1b0f4a51cd'
const USER_ID = '8c2d4e1f-9a3b-4c5d-8e7f-1a2b3c4d5e6f'

const routes: NotificationRoute[] = [
  {
    method: 'GET',
    path: '/things/:id',
    scope: 'user',
    operationId: 'getThing',
    summary: 'Devolve um objeto',
    async handler(context) {
      return { kind: 'json', status: 200, body: { data: { id: context.params.id, userId: context.auth?.userId } } }
    },
  },
  {
    method: 'POST',
    path: '/things',
    scope: 'user',
    bodySchema: z.object({ name: z.string().min(3) }),
    operationId: 'createThing',
    summary: 'Cria um objeto',
    async handler(context) {
      return { kind: 'json', status: 201, body: { data: context.body } }
    },
  },
  {
    method: 'DELETE',
    path: '/things/:id',
    scope: 'user',
    operationId: 'deleteThing',
    summary: 'Remove um objeto',
    async handler() {
      return { kind: 'empty', status: 204 }
    },
  },
  {
    method: 'GET',
    path: '/admin-things',
    scope: 'admin',
    requiredScopes: ['notifications:admin'],
    operationId: 'listAdminThings',
    summary: 'Rota que exige escopo declarado',
    async handler() {
      return { kind: 'json', status: 200, body: { data: [] } }
    },
  },
  {
    method: 'GET',
    path: '/public-things',
    scope: 'public',
    operationId: 'listPublicThings',
    summary: 'Rota pública',
    async handler() {
      return { kind: 'json', status: 200, body: { data: 'ok' } }
    },
  },
  {
    method: 'GET',
    path: '/boom',
    scope: 'public',
    operationId: 'boom',
    summary: 'Rota que estoura',
    async handler(): Promise<never> {
      throw new Error('erro interno qualquer com detalhe sensível')
    },
  },
]

function buildAuthResolver(auth: { userId?: string; scopes: string[] } | undefined): AuthContextResolverPort {
  return {
    async resolve({ headers }) {
      if (!headers.authorization) return undefined
      return auth ? { companyId: COMPANY_ID, userId: auth.userId, scopes: auth.scopes } : undefined
    },
  }
}

type AdapterResponse = {
  status: number
  body: unknown
}

type AdapterCall = (params: {
  method: string
  path: string
  headers?: Record<string, string>
  body?: unknown
}) => Promise<AdapterResponse>

function buildFetchAdapter(authResolver: AuthContextResolverPort): AdapterCall {
  const router = createNotificationFetchRouter({ routes, basePath: '/v1', authResolver })

  return async ({ method, path, headers, body }) => {
    const request = new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const response = await router.handle(request)
    const text = await response.text()
    return { status: response.status, body: text === '' ? undefined : JSON.parse(text) }
  }
}

/** Dublê mínimo do uWS: registra os handlers e permite invocá-los como o runtime real faria. */
function buildUwsAdapter(authResolver: AuthContextResolverPort): AdapterCall {
  const handlers = new Map<string, (res: UwsResponse, req: UwsRequest) => void>()
  const register =
    (method: string) =>
    (pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp => {
      handlers.set(`${method} ${pattern}`, handler)
      return app
    }

  const app: UwsApp = {
    get: register('GET'),
    post: register('POST'),
    put: register('PUT'),
    patch: register('PATCH'),
    del: register('DELETE'),
  }

  mountNotificationRoutes({ app, routes, basePath: '/v1', authResolver })

  return ({ method, path, headers, body }) =>
    new Promise<AdapterResponse>((resolve) => {
      const [pathname, queryString = ''] = path.split('?')
      // Encontra o padrão registrado que casa com este pathname (o uWS real faz o roteamento;
      // aqui reproduzimos só o suficiente para invocar o handler certo).
      const entry = [...handlers.entries()].find(([key]) => {
        const [registeredMethod, pattern] = key.split(' ')
        if (registeredMethod !== method) return false
        const regex = new RegExp(`^${(pattern ?? '').replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`)
        return regex.test(pathname ?? '')
      })

      if (!entry) {
        resolve({ status: 404, body: undefined })
        return
      }

      let status = 0
      let payload: string | undefined
      let dataCallback: ((chunk: ArrayBuffer, isLast: boolean) => void) | undefined

      const response: UwsResponse = {
        writeStatus(value: string) {
          status = Number.parseInt(value, 10)
          return response
        },
        writeHeader() {
          return response
        },
        write() {
          return true
        },
        end(value?: string) {
          payload = value
          resolve({ status, body: payload === undefined || payload === '' ? undefined : JSON.parse(payload) })
          return response
        },
        cork(callback: () => void) {
          callback()
        },
        onAborted() {},
        onData(callback) {
          dataCallback = callback
        },
      }

      const request: UwsRequest = {
        getMethod: () => method.toLowerCase(),
        getUrl: () => pathname ?? '',
        getQuery: () => queryString,
        forEach: (callback) => {
          for (const [key, value] of Object.entries(headers ?? {})) callback(key.toLowerCase(), value)
        },
      }

      entry[1](response, request)

      // O uWS entrega o corpo por `onData` depois que o handler registra o callback.
      if (dataCallback) {
        const encoded = new TextEncoder().encode(body === undefined ? '' : JSON.stringify(body))
        dataCallback(encoded.buffer as ArrayBuffer, true)
      }
    })
}

const adapters: { name: string; build: (authResolver: AuthContextResolverPort) => AdapterCall }[] = [
  { name: 'fetch', build: buildFetchAdapter },
  { name: 'uws', build: buildUwsAdapter },
]

for (const adapter of adapters) {
  describe(`contrato HTTP — adaptador ${adapter.name}`, () => {
    const authenticated = adapter.build(buildAuthResolver({ userId: USER_ID, scopes: ['notifications:admin'] }))
    const anonymous = adapter.build(buildAuthResolver(undefined))

    it('resolve parâmetro de rota e injeta a identidade autenticada', async () => {
      const response = await authenticated({
        method: 'GET',
        path: '/v1/things/abc-123',
        headers: { authorization: 'Bearer x' },
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ data: { id: 'abc-123', userId: USER_ID } })
    })

    it('valida o corpo e devolve TODOS os problemas de uma vez em 400', async () => {
      const response = await authenticated({
        method: 'POST',
        path: '/v1/things',
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
        body: { name: 'ab' },
      })

      expect(response.status).toBe(400)
      expect((response.body as { error: { code: string } }).error.code).toBe('NOTIFICATION_VALIDATION_ERROR')
      expect((response.body as { error: { issues: unknown[] } }).error.issues).toHaveLength(1)
    })

    it('aceita corpo válido e devolve 201', async () => {
      const response = await authenticated({
        method: 'POST',
        path: '/v1/things',
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
        body: { name: 'valido' },
      })

      expect(response.status).toBe(201)
      expect(response.body).toEqual({ data: { name: 'valido' } })
    })

    it('devolve 204 sem corpo', async () => {
      const response = await authenticated({
        method: 'DELETE',
        path: '/v1/things/abc',
        headers: { authorization: 'Bearer x' },
      })

      expect(response.status).toBe(204)
      expect(response.body).toBeUndefined()
    })

    it('sem identidade em rota de usuário responde 401', async () => {
      const response = await anonymous({ method: 'GET', path: '/v1/things/abc' })
      expect(response.status).toBe(401)
    })

    it('rota pública dispensa autenticação', async () => {
      const response = await anonymous({ method: 'GET', path: '/v1/public-things' })
      expect(response.status).toBe(200)
    })

    it('erro desconhecido vira 500 genérico, sem vazar a mensagem interna', async () => {
      const response = await anonymous({ method: 'GET', path: '/v1/boom' })

      expect(response.status).toBe(500)
      expect(JSON.stringify(response.body)).not.toContain('detalhe sensível')
      expect((response.body as { error: { code: string } }).error.code).toBe('NOTIFICATION_INTERNAL_ERROR')
    })

    it('rota fora da tabela devolve 404', async () => {
      const response = await anonymous({ method: 'GET', path: '/v1/inexistente' })
      expect(response.status).toBe(404)
    })
  })
}

describe('escopo de admin', () => {
  it('recusa com 403 quem está autenticado mas não tem o escopo exigido', async () => {
    const withoutScope = buildFetchAdapter(buildAuthResolver({ userId: USER_ID, scopes: ['outro:escopo'] }))
    const response = await withoutScope({
      method: 'GET',
      path: '/v1/admin-things',
      headers: { authorization: 'Bearer x' },
    })

    // 403 e não 401: há identidade, o que falta é permissão — a distinção diz ao cliente se ele
    // deve fazer login ou pedir acesso.
    expect(response.status).toBe(403)
  })

  it('aceita quem tem o escopo declarado', async () => {
    const withScope = buildFetchAdapter(buildAuthResolver({ userId: USER_ID, scopes: ['notifications:admin'] }))
    const response = await withScope({
      method: 'GET',
      path: '/v1/admin-things',
      headers: { authorization: 'Bearer x' },
    })

    expect(response.status).toBe(200)
  })
})
