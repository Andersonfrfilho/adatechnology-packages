/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comportamento do CRUD de recurso contra o dublê em memória — molde de `Booking.use-cases.test.ts`.
 */

import { describe, expect, it } from 'bun:test'

import { RESOURCE_KIND, ResourceNotFoundError } from '@adatechnology/scheduling-contracts'

import { createInMemoryResources } from '../testing/inMemoryRepositories'
import {
  CreateResourceUseCase,
  DeleteResourceUseCase,
  GetResourceUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from './Resource.use-cases'
import type { SchedulingDependencies } from './schedulingModule.types'

const COMPANY_ID = 'company-1'
const OTHER_COMPANY_ID = 'company-2'

function buildDependencies() {
  const resources = createInMemoryResources()
  const dependencies = {
    repositories: { resources, services: {}, bookings: {}, availability: {} },
    config: { maxLookaheadDays: 60 },
  } as unknown as SchedulingDependencies
  return { dependencies, resources }
}

describe('CreateResourceUseCase', () => {
  it('cria recurso com valores padrão preenchidos pelo dublê', async () => {
    const { dependencies } = buildDependencies()

    const resource = await new CreateResourceUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { name: 'Sala 1', kind: RESOURCE_KIND.ROOM, timezone: 'America/Sao_Paulo' },
    })

    expect(resource.name).toBe('Sala 1')
    expect(resource.active).toBe(true)
  })
})

describe('UpdateResourceUseCase', () => {
  it('atualiza só os campos enviados', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    const updated = await new UpdateResourceUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: resource.id,
      input: { name: 'Sala 2' },
    })

    expect(updated.name).toBe('Sala 2')
    expect(updated.timezone).toBe('America/Sao_Paulo')
  })

  it('lança ResourceNotFoundError para recurso de outra empresa', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await resources.create({
      companyId: OTHER_COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    await expect(
      new UpdateResourceUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: resource.id,
        input: { name: 'Sala 2' },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('DeleteResourceUseCase', () => {
  it('marca deletedAt e some das listagens', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    await new DeleteResourceUseCase(dependencies).execute({ companyId: COMPANY_ID, id: resource.id })

    await expect(
      new GetResourceUseCase(dependencies).execute({ companyId: COMPANY_ID, id: resource.id }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('lança ResourceNotFoundError se o recurso não existe', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new DeleteResourceUseCase(dependencies).execute({ companyId: COMPANY_ID, id: 'inexistente' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('ListResourcesUseCase', () => {
  it('pagina e filtra por empresa', async () => {
    const { dependencies, resources } = buildDependencies()
    await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })
    await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 2',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })
    await resources.create({
      companyId: OTHER_COMPANY_ID,
      name: 'Sala X',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    const page = await new ListResourcesUseCase(dependencies).execute({ companyId: COMPANY_ID })

    expect(page.total).toBe(2)
    expect(page.data).toHaveLength(2)
  })
})
