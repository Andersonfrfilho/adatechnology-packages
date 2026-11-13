/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { compileRoutes, dispatchRoute } from '@adatechnology/module-http'
import type { AuthContext } from '@adatechnology/module-http'
import { INFRA_ADMIN_SCOPE, INFRA_ROUTE_PATH } from '@adatechnology/infra-contracts'
import type { InfraRoutesDependencies } from '@adatechnology/infra-contracts'

import { createInfraRoutes } from './createInfraRoutes'

const ADMIN: AuthContext = { companyId: 'c1', userId: 'a1', scopes: [INFRA_ADMIN_SCOPE] }
const ENVIRONMENT_ID = '11111111-1111-4111-8111-111111111111'

function buildDependencies(overrides: Partial<InfraRoutesDependencies> = {}): InfraRoutesDependencies {
  const power = { execute: async () => ({ operationId: 'op-1' }) }
  return {
    listInfraEnvironments: { execute: async () => ({ access: 'ok', projects: [] }) as never },
    powerOffEnvironment: power,
    powerOnEnvironment: power,
    getInfraOperation: { execute: async () => ({}) as never },
    getInfraCosts: { execute: async () => ({}) as never },
    saveEnvironmentSchedule: { execute: async () => ({}) as never },
    getInfraIntegration: { execute: async () => ({ source: 'none' }) as never },
    saveInfraIntegration: { execute: async () => ({}) as never },
    removeInfraIntegration: { execute: async () => ({}) as never },
    verifyInfraIntegration: { execute: async () => ({}) as never },
    ...overrides,
  }
}

async function call(params: {
  readonly dependencies: InfraRoutesDependencies
  readonly method: string
  readonly path: string
  readonly auth?: AuthContext
}) {
  return dispatchRoute({
    compiledRoutes: compileRoutes(createInfraRoutes(params.dependencies), ''),
    request: { method: params.method, pathname: params.path, query: {}, headers: {} },
    authResolver: { resolve: async () => params.auth },
  })
}

describe('createInfraRoutes', () => {
  it('declara as dez rotas, todas de administrador', () => {
    const routes = createInfraRoutes(buildDependencies())

    expect(routes).toHaveLength(10)
    expect(routes.every((route) => route.scope === 'admin')).toBe(true)
    expect(new Set(routes.map((route) => route.operationId)).size).toBe(10)
  })

  it('recusa sem identidade e sem o escopo de infraestrutura', async () => {
    const dependencies = buildDependencies()

    const anonymous = await call({ dependencies, method: 'GET', path: INFRA_ROUTE_PATH.COSTS })
    const withoutScope = await call({
      dependencies,
      method: 'GET',
      path: INFRA_ROUTE_PATH.COSTS,
      auth: { ...ADMIN, scopes: [] },
    })

    expect(anonymous).toMatchObject({ kind: 'json', status: 401 })
    expect(withoutScope).toMatchObject({ kind: 'json', status: 403 })
  })

  it('devolve o envelope data e esconde quem editou a agenda', async () => {
    const dependencies = buildDependencies({
      listInfraEnvironments: {
        execute: async () =>
          ({
            access: 'ok',
            projects: [
              { id: 'p1', environments: [{ id: 'e1', schedule: { isEnabled: true, updatedByAgentId: 'a1' } }] },
            ],
          }) as never,
      },
    })

    const result = await call({ dependencies, method: 'GET', path: INFRA_ROUTE_PATH.ENVIRONMENTS, auth: ADMIN })

    expect(result).toMatchObject({ kind: 'json', status: 200 })
    const body = (result as { body: { data: { projects: { environments: { schedule: object }[] }[] } } }).body
    expect(body.data.projects[0]?.environments[0]?.schedule).toEqual({ isEnabled: true })
  })

  it('responde 202 ao desligar e consulta o limite por administrador', async () => {
    const consumed: string[] = []
    const dependencies = buildDependencies({
      rateLimiter: {
        consume: async ({ bucket, identity }) => {
          consumed.push(`${bucket}:${identity}`)
          return { isAllowed: true }
        },
      },
    })

    const result = await call({
      dependencies,
      method: 'POST',
      path: `/infra/environments/${ENVIRONMENT_ID}/power-off`,
      auth: ADMIN,
    })

    expect(result).toMatchObject({ kind: 'json', status: 202, body: { data: { operationId: 'op-1' } } })
    expect(consumed).toEqual(['POST:infra-power-off:agent:a1'])
  })

  it('devolve 429 com Retry-After quando o limite por administrador estoura', async () => {
    const dependencies = buildDependencies({
      rateLimiter: { consume: async () => ({ isAllowed: false, retryAfterSeconds: 42 }) },
    })

    const result = await call({
      dependencies,
      method: 'POST',
      path: `/infra/environments/${ENVIRONMENT_ID}/power-on`,
      auth: ADMIN,
    })

    expect(result).toMatchObject({ kind: 'json', status: 429, headers: { 'Retry-After': '42' } })
  })

  it('marca as rotas de integração como no-store', () => {
    const noStore = createInfraRoutes(buildDependencies()).filter((route) => route.isNoStore)

    expect(noStore.map((route) => route.operationId).sort()).toEqual([
      'getInfraIntegration',
      'removeInfraIntegration',
      'saveInfraIntegration',
      'verifyInfraIntegration',
    ])
  })
})
