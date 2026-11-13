/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comportamento do CRUD de serviço e do vínculo com recurso contra os dublês em memória.
 */

import { describe, expect, it } from 'bun:test'

import { RESOURCE_KIND, ResourceNotFoundError, ServiceNotFoundError } from '@adatechnology/scheduling-contracts'

import { createInMemoryResources, createInMemoryServices } from '../testing/inMemoryRepositories'
import type { SchedulingDependencies } from './schedulingModule.types'
import {
  CreateServiceUseCase,
  DeleteServiceUseCase,
  GetServiceUseCase,
  LinkResourceToServiceUseCase,
  ListServicesUseCase,
  UnlinkResourceFromServiceUseCase,
  UpdateServiceUseCase,
} from './Service.use-cases'

const COMPANY_ID = 'company-1'
const OTHER_COMPANY_ID = 'company-2'

function buildDependencies() {
  const resources = createInMemoryResources()
  const services = createInMemoryServices()
  const dependencies = {
    repositories: { resources, services, bookings: {}, availability: {} },
    config: { maxLookaheadDays: 60 },
  } as unknown as SchedulingDependencies
  return { dependencies, resources, services }
}

describe('CreateServiceUseCase', () => {
  it('cria serviço com valores padrão preenchidos pelo dublê', async () => {
    const { dependencies } = buildDependencies()

    const service = await new CreateServiceUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { name: 'Corte de cabelo', durationMinutes: 30 },
    })

    expect(service.name).toBe('Corte de cabelo')
    expect(service.active).toBe(true)
    expect(service.requiresConfirmation).toBe(false)
  })
})

describe('UpdateServiceUseCase', () => {
  it('atualiza só os campos enviados', async () => {
    const { dependencies, services } = buildDependencies()
    const service = await services.create({ companyId: COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    const updated = await new UpdateServiceUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: service.id,
      input: { name: 'Corte e barba' },
    })

    expect(updated.name).toBe('Corte e barba')
    expect(updated.durationMinutes).toBe(30)
  })

  it('lança ServiceNotFoundError para serviço de outra empresa', async () => {
    const { dependencies, services } = buildDependencies()
    const service = await services.create({ companyId: OTHER_COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    await expect(
      new UpdateServiceUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: service.id,
        input: { name: 'Corte e barba' },
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError)
  })
})

describe('DeleteServiceUseCase', () => {
  it('marca deletedAt e some das listagens', async () => {
    const { dependencies, services } = buildDependencies()
    const service = await services.create({ companyId: COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    await new DeleteServiceUseCase(dependencies).execute({ companyId: COMPANY_ID, id: service.id })

    await expect(
      new GetServiceUseCase(dependencies).execute({ companyId: COMPANY_ID, id: service.id }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError)
  })
})

describe('ListServicesUseCase', () => {
  it('pagina e filtra por empresa', async () => {
    const { dependencies, services } = buildDependencies()
    await services.create({ companyId: COMPANY_ID, name: 'Corte', durationMinutes: 30 })
    await services.create({ companyId: COMPANY_ID, name: 'Barba', durationMinutes: 20 })
    await services.create({ companyId: OTHER_COMPANY_ID, name: 'Outro', durationMinutes: 15 })

    const page = await new ListServicesUseCase(dependencies).execute({ companyId: COMPANY_ID })

    expect(page.total).toBe(2)
  })
})

describe('LinkResourceToServiceUseCase', () => {
  it('vincula quando recurso e serviço pertencem à mesma empresa', async () => {
    const { dependencies, resources, services } = buildDependencies()
    const resource = await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })
    const service = await services.create({ companyId: COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    await expect(
      new LinkResourceToServiceUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        resourceId: resource.id,
        serviceId: service.id,
      }),
    ).resolves.toBeUndefined()
  })

  it('lança ResourceNotFoundError quando o recurso é de outra empresa (BOLA)', async () => {
    const { dependencies, resources, services } = buildDependencies()
    const resource = await resources.create({
      companyId: OTHER_COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })
    const service = await services.create({ companyId: COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    await expect(
      new LinkResourceToServiceUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        resourceId: resource.id,
        serviceId: service.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('UnlinkResourceFromServiceUseCase', () => {
  it('lança ServiceNotFoundError quando o serviço é de outra empresa (BOLA)', async () => {
    const { dependencies, resources, services } = buildDependencies()
    const resource = await resources.create({
      companyId: COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })
    const service = await services.create({ companyId: OTHER_COMPANY_ID, name: 'Corte', durationMinutes: 30 })

    await expect(
      new UnlinkResourceFromServiceUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        resourceId: resource.id,
        serviceId: service.id,
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError)
  })
})
