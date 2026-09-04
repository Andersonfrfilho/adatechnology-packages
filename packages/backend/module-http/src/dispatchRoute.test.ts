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
