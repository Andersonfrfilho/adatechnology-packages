/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comportamento dos use-cases de gestão de grade/exceção de disponibilidade contra os dublês em
 * memória. `ListAvailableSlotsUseCase` fica fora daqui — depende de `resolveLocalInstant`
 * (Postgres real) e só tem teste de integração (`Availability.use-cases.integration.test.ts`).
 */

import { describe, expect, it } from 'bun:test'

import {
  AVAILABILITY_EXCEPTION_KIND,
  AvailabilityExceptionNotFoundError,
  RESOURCE_KIND,
  ResourceNotFoundError,
} from '@adatechnology/scheduling-contracts'

import { createInMemoryAvailability, createInMemoryResources } from '../testing/inMemoryRepositories'
import {
  AddAvailabilityExceptionUseCase,
  ListAvailabilityExceptionsUseCase,
  ListAvailabilityRulesUseCase,
  RemoveAvailabilityExceptionUseCase,
  SetAvailabilityRulesUseCase,
} from './Availability.use-cases'
import type { SchedulingDependencies } from './schedulingModule.types'

const COMPANY_ID = 'company-1'
const OTHER_COMPANY_ID = 'company-2'

function buildDependencies() {
  const resources = createInMemoryResources()
  const availability = createInMemoryAvailability()
  const dependencies = {
    repositories: { resources, services: {}, bookings: {}, availability },
    config: { maxLookaheadDays: 60 },
  } as unknown as SchedulingDependencies
  return { dependencies, resources, availability }
}

async function createResource(dependencies: ReturnType<typeof buildDependencies>) {
  return dependencies.resources.create({
    companyId: COMPANY_ID,
    name: 'Sala 1',
    kind: RESOURCE_KIND.ROOM,
    timezone: 'America/Sao_Paulo',
  })
}

describe('SetAvailabilityRulesUseCase', () => {
  it('substitui a grade semanal inteira do recurso', async () => {
    const dependencies = buildDependencies()
    const resource = await createResource(dependencies)

    await new SetAvailabilityRulesUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resource.id,
      rules: [{ weekday: 1, startsAtLocal: '09:00', endsAtLocal: '12:00' }],
    })

    const replaced = await new SetAvailabilityRulesUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resource.id,
      rules: [
        { weekday: 2, startsAtLocal: '10:00', endsAtLocal: '18:00' },
        { weekday: 3, startsAtLocal: '10:00', endsAtLocal: '18:00' },
      ],
    })

    expect(replaced).toHaveLength(2)
    const rules = await new ListAvailabilityRulesUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resource.id,
    })
    expect(rules).toHaveLength(2)
    expect(rules.map((rule) => rule.weekday).sort()).toEqual([2, 3])
  })

  it('lança ResourceNotFoundError quando o recurso não existe', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new SetAvailabilityRulesUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        resourceId: 'inexistente',
        rules: [{ weekday: 1, startsAtLocal: '09:00', endsAtLocal: '12:00' }],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('ListAvailabilityRulesUseCase', () => {
  it('lança ResourceNotFoundError quando o recurso é de outra empresa', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await resources.create({
      companyId: OTHER_COMPANY_ID,
      name: 'Sala 1',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    await expect(
      new ListAvailabilityRulesUseCase(dependencies).execute({ companyId: COMPANY_ID, resourceId: resource.id }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('AddAvailabilityExceptionUseCase', () => {
  it('cria uma exceção do tipo block', async () => {
    const dependencies = buildDependencies()
    const resource = await createResource(dependencies)

    const exception = await new AddAvailabilityExceptionUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        resourceId: resource.id,
        during: { start: new Date('2026-08-20T12:00:00.000Z'), end: new Date('2026-08-20T18:00:00.000Z') },
        kind: AVAILABILITY_EXCEPTION_KIND.BLOCK,
      },
    })

    expect(exception.kind).toBe(AVAILABILITY_EXCEPTION_KIND.BLOCK)

    const list = await new ListAvailabilityExceptionsUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resource.id,
    })
    expect(list).toHaveLength(1)
  })

  it('lança ResourceNotFoundError quando o recurso não existe', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new AddAvailabilityExceptionUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        input: {
          resourceId: 'inexistente',
          during: { start: new Date('2026-08-20T12:00:00.000Z'), end: new Date('2026-08-20T18:00:00.000Z') },
          kind: AVAILABILITY_EXCEPTION_KIND.EXTRA,
        },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})

describe('RemoveAvailabilityExceptionUseCase', () => {
  it('remove uma exceção existente', async () => {
    const dependencies = buildDependencies()
    const resource = await createResource(dependencies)
    const exception = await dependencies.availability.createException({
      companyId: COMPANY_ID,
      resourceId: resource.id,
      duringStart: new Date('2026-08-20T12:00:00.000Z'),
      duringEnd: new Date('2026-08-20T18:00:00.000Z'),
      kind: AVAILABILITY_EXCEPTION_KIND.BLOCK,
    })

    await new RemoveAvailabilityExceptionUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      id: exception.id,
    })

    const list = await new ListAvailabilityExceptionsUseCase(dependencies.dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resource.id,
    })
    expect(list).toHaveLength(0)
  })

  it('lança AvailabilityExceptionNotFoundError quando a exceção não existe', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new RemoveAvailabilityExceptionUseCase(dependencies).execute({ companyId: COMPANY_ID, id: 'inexistente' }),
    ).rejects.toBeInstanceOf(AvailabilityExceptionNotFoundError)
  })

  it('não remove exceção de outra empresa (BOLA)', async () => {
    const dependencies = buildDependencies()
    const resource = await createResource(dependencies)
    const exception = await dependencies.availability.createException({
      companyId: COMPANY_ID,
      resourceId: resource.id,
      duringStart: new Date('2026-08-20T12:00:00.000Z'),
      duringEnd: new Date('2026-08-20T18:00:00.000Z'),
      kind: AVAILABILITY_EXCEPTION_KIND.BLOCK,
    })

    await expect(
      new RemoveAvailabilityExceptionUseCase(dependencies.dependencies).execute({
        companyId: OTHER_COMPANY_ID,
        id: exception.id,
      }),
    ).rejects.toBeInstanceOf(AvailabilityExceptionNotFoundError)
  })
})
