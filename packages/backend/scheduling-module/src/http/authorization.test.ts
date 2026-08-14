/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * BOLA / API1 (T5.3) sobre as rotas **reais** do módulo: trocar o id na URL não dá acesso ao
 * recurso de outra empresa. Sempre 404, nunca 403 — confirmar a existência do recurso já seria
 * vazamento.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import type { AuthContextResolverPort } from '@adatechnology/module-http'

import { createSchedulingRoutes } from './routes'
import type { SchedulingModule } from '../SchedulingModule'
import {
  CreateResourceUseCase,
  DeleteResourceUseCase,
  GetResourceUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from '../use-cases/Resource.use-cases'
import {
  createInMemoryAvailability,
  createInMemoryBookings,
  createInMemoryResources,
  createInMemoryServices,
} from '../testing/inMemoryRepositories'
import type { SchedulingDependencies } from '../use-cases/schedulingModule.types'
import type { ResourceRow } from '../schema/schema'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()
const EPOCH = new Date('2026-08-02T12:00:00.000Z')

function buildResourceRow(companyId: string): ResourceRow {
  return {
    id: randomUUID(),
    companyId,
    name: 'Sala de reunião',
    kind: 'room',
    timezone: 'America/Sao_Paulo',
    externalRef: null,
    active: true,
    deletedAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  } as ResourceRow
}

function buildRouter(params: { seed: ResourceRow[]; authCompanyId: string }) {
  const resources = createInMemoryResources(params.seed)
  const dependencies = {
    repositories: {
      resources,
      services: createInMemoryServices(),
      availability: createInMemoryAvailability(),
      bookings: createInMemoryBookings(),
    },
    config: { maxLookaheadDays: 60 },
  } as unknown as SchedulingDependencies

  const module = {
    useCases: {
      createResource: new CreateResourceUseCase(dependencies),
      updateResource: new UpdateResourceUseCase(dependencies),
      deleteResource: new DeleteResourceUseCase(dependencies),
      getResource: new GetResourceUseCase(dependencies),
      listResources: new ListResourcesUseCase(dependencies),
    },
    hasCalendarSync: false,
    hasVideoMeeting: false,
  } as unknown as SchedulingModule

  const authResolver: AuthContextResolverPort = {
    async resolve() {
      return { companyId: params.authCompanyId, scopes: [] }
    },
  }

  return {
    resources,
    router: createModuleFetchRouter({ routes: createSchedulingRoutes({ module }), basePath: '/v1', authResolver }),
  }
}

describe('BOLA — recurso de outra empresa', () => {
  it('ler devolve 404, não 403', async () => {
    const foreign = buildResourceRow(COMPANY_B)
    const { router } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(new Request(`http://localhost/v1/resources/${foreign.id}`))

    // 403 confirmaria que o id existe. 404 não diz nada.
    expect(response.status).toBe(404)
  })

  it('atualizar devolve 404 e não altera nada', async () => {
    const foreign = buildResourceRow(COMPANY_B)
    const { router, resources } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request(`http://localhost/v1/resources/${foreign.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Sequestrada' }),
      }),
    )

    expect(response.status).toBe(404)
    expect(resources.rows[0]?.name).toBe('Sala de reunião')
  })

  it('excluir devolve 404 e não apaga', async () => {
    const foreign = buildResourceRow(COMPANY_B)
    const { router, resources } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request(`http://localhost/v1/resources/${foreign.id}`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(404)
    expect(resources.rows[0]?.deletedAt).toBeNull()
  })

  it('listar não devolve recurso de outra empresa', async () => {
    const foreign = buildResourceRow(COMPANY_B)
    const { router } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(new Request('http://localhost/v1/resources'))
    const payload = (await response.json()) as { data: unknown[] }

    expect(payload.data).toHaveLength(0)
  })
})

describe('o dono continua com acesso', () => {
  it('lê e atualiza o próprio recurso', async () => {
    const own = buildResourceRow(COMPANY_A)
    const { router, resources } = buildRouter({ seed: [own], authCompanyId: COMPANY_A })

    const read = await router.handle(new Request(`http://localhost/v1/resources/${own.id}`))
    expect(read.status).toBe(200)

    const updated = await router.handle(
      new Request(`http://localhost/v1/resources/${own.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Sala renomeada' }),
      }),
    )

    expect(updated.status).toBe(200)
    expect(resources.rows[0]?.name).toBe('Sala renomeada')
  })
})

describe('rota inexistente e validação', () => {
  it('rota fora da tabela devolve 404 sem tocar no módulo', async () => {
    const { router } = buildRouter({ seed: [], authCompanyId: COMPANY_A })
    const response = await router.handle(new Request('http://localhost/v1/inexistente'))
    expect(response.status).toBe(404)
  })

  it('corpo inválido devolve 400 com todos os problemas de uma vez', async () => {
    const { router } = buildRouter({ seed: [], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request('http://localhost/v1/resources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', kind: '', timezone: '' }),
      }),
    )
    const payload = (await response.json()) as { error: { code: string; issues: unknown[] } }

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.issues.length).toBeGreaterThanOrEqual(2)
  })
})
