/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { compileRoutes, dispatchRoute } from './dispatchRoute'
import type { ModuleRoute } from './types'

/**
 * REGRESSÃO: `requiredScopes` era ignorado em rota de escopo `user` — o despachante autorizava
 * assim que via `userId` e nunca chegava à checagem. Quem podia ler podia escrever, em qualquer
 * módulo que separasse os dois dentro do escopo de pessoa.
 */
describe('requiredScopes em rota de pessoa', () => {
  const rota: ModuleRoute = {
    method: 'POST',
    path: '/coisas',
    scope: 'user',
    requiredScopes: ['coisas:write'],
    operationId: 'criarCoisa',
    summary: 'Cria',
    async handler() {
      return { kind: 'json', status: 201, body: { ok: true } }
    },
  }

  function despachar(auth: { userId?: string; scopes: string[] } | undefined) {
    return dispatchRoute({
      compiledRoutes: compileRoutes([rota], ''),
      request: { method: 'POST', pathname: '/coisas', query: {}, headers: {}, rawBody: new Uint8Array() },
      ...(auth
        ? {
            authResolver: {
              async resolve() {
                return { companyId: 'c', ...auth }
              },
            },
          }
        : {}),
    })
  }

  it('recusa com 403 quem está autenticado mas não tem o escopo', async () => {
    const result = await despachar({ userId: 'u', scopes: ['coisas:read'] })

    expect(result).toMatchObject({ status: 403 })
  })

  it('aceita quem tem o escopo', async () => {
    const result = await despachar({ userId: 'u', scopes: ['coisas:read', 'coisas:write'] })

    expect(result).toMatchObject({ status: 201 })
  })

  it('sem identidade nenhuma continua 401, não 403', async () => {
    const result = await despachar(undefined)

    expect(result).toMatchObject({ status: 401 })
  })
})

/**
 * SEGURANÇA: rota `admin`/`service` é administrativa por definição. Com `requiredScopes` declarado,
 * só quem tem um deles passa; sem declarar, ainda assim uma sessão sem escopo nenhum não passa.
 */
describe('escopo em rota administrativa', () => {
  function buildRoute(overrides: Partial<ModuleRoute>): ModuleRoute {
    return {
      method: 'DELETE',
      path: '/coisas/:id',
      scope: 'admin',
      operationId: 'removerCoisa',
      summary: 'Remove',
      async handler() {
        return { kind: 'empty', status: 204 }
      },
      ...overrides,
    }
  }

  function dispatchAs(route: ModuleRoute, auth: { userId?: string; scopes: string[] } | undefined) {
    return dispatchRoute({
      compiledRoutes: compileRoutes([route], ''),
      request: { method: 'DELETE', pathname: '/coisas/1', query: {}, headers: {} },
      authResolver: {
        async resolve() {
          return auth ? { companyId: 'c', ...auth } : undefined
        },
      },
    })
  }

  const declared = buildRoute({ requiredScopes: ['coisas:admin'] })
  const undeclared = buildRoute({})

  it('401 sem identidade', async () => {
    expect(await dispatchAs(declared, undefined)).toMatchObject({ status: 401 })
  })

  it('403 com identidade sem o escopo declarado', async () => {
    expect(await dispatchAs(declared, { userId: 'u', scopes: ['coisas:read'] })).toMatchObject({ status: 403 })
  })

  it('200 com o escopo declarado', async () => {
    expect(await dispatchAs(declared, { userId: 'u', scopes: ['coisas:admin'] })).toMatchObject({ status: 204 })
  })

  it('sem requiredScopes, sessão sem escopo nenhum recebe 403', async () => {
    expect(await dispatchAs(undeclared, { userId: 'u', scopes: [] })).toMatchObject({ status: 403 })
  })

  it('sem requiredScopes, qualquer escopo do host basta', async () => {
    expect(await dispatchAs(undeclared, { scopes: ['host:admin'] })).toMatchObject({ status: 204 })
  })

  it('service segue a mesma regra', async () => {
    const service = buildRoute({ scope: 'service' })
    expect(await dispatchAs(service, { scopes: [] })).toMatchObject({ status: 403 })
    expect(await dispatchAs(service, { scopes: ['robot'] })).toMatchObject({ status: 204 })
  })

  it('user sem requiredScopes continua aceitando a pessoa sem escopo', async () => {
    const userRoute = buildRoute({ scope: 'user' })
    expect(await dispatchAs(userRoute, { userId: 'u', scopes: [] })).toMatchObject({ status: 204 })
  })
})
