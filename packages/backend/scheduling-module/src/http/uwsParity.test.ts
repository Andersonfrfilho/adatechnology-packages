/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Critério de aceite da §10: rotas prontas **nos dois adaptadores**. Roda a tabela **real** de
 * agendamento pelo uWS e pelo fetch — equivalência genérica do `module-http` não cobre detalhe
 * específico destas rotas (T5.2, "o defeito 4 do gate do catálogo").
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import { mountModuleRoutes } from '@adatechnology/module-http/uws'
import { createUwsHarness } from '@adatechnology/module-http/testing'
import type { AuthContextResolverPort } from '@adatechnology/module-http'

import { createSchedulingRoutes } from './routes'
import type { SchedulingModule } from '../SchedulingModule'
import { CreateResourceUseCase, ListResourcesUseCase } from '../use-cases/Resource.use-cases'
import {
  createInMemoryAvailability,
  createInMemoryBookings,
  createInMemoryResources,
  createInMemoryServices,
} from '../testing/inMemoryRepositories'
import type { SchedulingDependencies } from '../use-cases/schedulingModule.types'

const COMPANY_ID = randomUUID()

function buildModule() {
  const dependencies = {
    repositories: {
      resources: createInMemoryResources(),
      services: createInMemoryServices(),
      availability: createInMemoryAvailability(),
      bookings: createInMemoryBookings(),
    },
    config: { maxLookaheadDays: 60 },
  } as unknown as SchedulingDependencies

  return {
    useCases: {
      createResource: new CreateResourceUseCase(dependencies),
      listResources: new ListResourcesUseCase(dependencies),
    },
    hasCalendarSync: false,
    hasVideoMeeting: false,
  } as unknown as SchedulingModule
}

const authResolver: AuthContextResolverPort = {
  async resolve() {
    return { companyId: COMPANY_ID, scopes: ['scheduling:admin'] }
  },
}

/** Roda a mesma requisição lógica nos dois adaptadores e devolve os dois resultados. */
async function callBoth(params: { method: string; path: string; body?: unknown }) {
  const routes = createSchedulingRoutes({ module: buildModule() })

  const fetchRouter = createModuleFetchRouter({ routes, basePath: '/v1', authResolver })
  const fetchResponse = await fetchRouter.handle(
    new Request(`http://localhost${params.path}`, {
      method: params.method,
      headers: params.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
    }),
  )
  const fetchText = await fetchResponse.text()

  const harness = createUwsHarness()
  mountModuleRoutes({ app: harness.app, routes, basePath: '/v1', authResolver })
  const uwsResult = await harness.call({ method: params.method, path: params.path, body: params.body })

  return {
    fetch: { status: fetchResponse.status, body: fetchText === '' ? undefined : JSON.parse(fetchText) },
    uws: uwsResult,
  }
}

describe('rotas reais de agendamento — paridade entre fetch e uws', () => {
  it('listar recursos devolve o mesmo status e envelope', async () => {
    const { fetch, uws } = await callBoth({ method: 'GET', path: '/v1/resources' })

    expect(uws.status).toBe(fetch.status)
    expect(uws.body).toEqual(fetch.body)
    expect(fetch.status).toBe(200)
  })

  it('criar recurso devolve 201 e o mesmo corpo nos dois', async () => {
    const body = { name: 'Sala 1', kind: 'room', timezone: 'America/Sao_Paulo' }
    const { fetch, uws } = await callBoth({ method: 'POST', path: '/v1/resources', body })

    expect(fetch.status).toBe(201)
    expect(uws.status).toBe(201)
    // Ids são gerados, então compara a forma, não o valor.
    expect(Object.keys((uws.body as { data: object }).data).sort()).toEqual(
      Object.keys((fetch.body as { data: object }).data).sort(),
    )
  })

  it('validação inválida devolve 400 idêntico nos dois', async () => {
    const { fetch, uws } = await callBoth({
      method: 'POST',
      path: '/v1/resources',
      body: { name: '', kind: '', timezone: '' },
    })

    expect(fetch.status).toBe(400)
    expect(uws.status).toBe(400)
    expect((uws.body as { error: { code: string } }).error.code).toBe(
      (fetch.body as { error: { code: string } }).error.code,
    )
  })

  it('query string de listagem chega igual nos dois adaptadores', async () => {
    const { fetch, uws } = await callBoth({ method: 'GET', path: '/v1/resources?kind=room&page=1&pageSize=10' })

    expect(uws.status).toBe(fetch.status)
    expect(uws.body).toEqual(fetch.body)
  })

  it('rota inexistente devolve 404 nos dois', async () => {
    const { fetch, uws } = await callBoth({ method: 'GET', path: '/v1/nao-existe' })

    expect(fetch.status).toBe(404)
    expect(uws.status).toBe(404)
  })
})
