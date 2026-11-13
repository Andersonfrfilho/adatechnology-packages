/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres — `AvailabilityRepository.resolveLocalInstants` (T3.2, F-008) usa
 * `AT TIME ZONE`, e só um banco de verdade prova que o deslocamento muda quando a data cruza uma
 * virada de horário de verão; um dublê em memória testaria a reimplementação, não a conversão que
 * protege produção (mesma razão documentada em `testing/inMemoryRepositories.ts`). Este arquivo
 * também prova a fórmula completa da disponibilidade (spec §7: regra − bloqueio + extra − reserva)
 * e o respeito a `validFrom`/`validUntil` (T3.4) fim a fim, porque as duas dependem do mesmo
 * `resolveLocalInstants`.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { AVAILABILITY_EXCEPTION_KIND, BOOKING_STATUS } from '@adatechnology/scheduling-contracts'

import type { SchedulingDatabase } from '../database.types'
import { AvailabilityRepository } from '../repositories/AvailabilityRepository'
import { BookingRepository } from '../repositories/BookingRepository'
import { ResourceRepository } from '../repositories/ResourceRepository'
import { ServiceRepository } from '../repositories/ServiceRepository'
import { runSchedulingMigrations } from '../runMigrations'
import { bookings, resources } from '../schema/schema'
import { ListAvailableSlotsUseCase } from './Availability.use-cases'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('ListAvailableSlotsUseCase (integração Postgres real)', () => {
  const companyId = crypto.randomUUID()
  let sql: SQL
  let db: SchedulingDatabase
  let resourceRepository: ResourceRepository
  let serviceRepository: ServiceRepository
  let bookingRepository: BookingRepository
  let useCase: ListAvailableSlotsUseCase

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle(sql) as unknown as SchedulingDatabase
    await runSchedulingMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

    resourceRepository = new ResourceRepository(db)
    serviceRepository = new ServiceRepository(db)
    bookingRepository = new BookingRepository(db)
    useCase = new ListAvailableSlotsUseCase({
      repositories: {
        resources: resourceRepository,
        services: serviceRepository,
        availability: new AvailabilityRepository(db),
        bookings: bookingRepository,
      },
      config: { maxLookaheadDays: 400 },
    })
  })

  afterAll(async () => {
    await db.delete(bookings).where(eq(bookings.companyId, companyId))
    await db.delete(resources).where(eq(resources.companyId, companyId))
    await sql.end()
  })

  async function createResourceAndService(params: { timezone: string; durationMinutes: number }) {
    const resource = await resourceRepository.create({
      companyId,
      name: 'Recurso de teste',
      kind: 'room',
      timezone: params.timezone,
    })
    const service = await serviceRepository.create({
      companyId,
      name: 'Serviço de teste',
      durationMinutes: params.durationMinutes,
    })
    await serviceRepository.linkResource({ companyId, resourceId: resource.id, serviceId: service.id })
    return { resource, service }
  }

  test('T3.2 — DST em Europe/Lisbon: a regra de 09:00 continua às 09:00 locais nos dois lados da virada', async () => {
    const availabilityRepository = new AvailabilityRepository(db)
    const { resource, service } = await createResourceAndService({ timezone: 'Europe/Lisbon', durationMinutes: 60 })

    // Virada de horário de verão na Europa em 2027 é na madrugada de domingo 28/03. Segunda 22/03
    // ainda é WET (UTC+0); segunda 29/03 já é WEST (UTC+1) — mesma regra, deslocamento diferente.
    await availabilityRepository.createRule({
      companyId,
      resourceId: resource.id,
      weekday: 1,
      startsAtLocal: '09:00',
      endsAtLocal: '10:00',
    })

    const slots = await useCase.execute({
      companyId,
      resourceId: resource.id,
      serviceId: service.id,
      from: new Date('2027-03-21T00:00:00Z'),
      until: new Date('2027-04-01T00:00:00Z'),
    })

    const beforeDst = slots.find((slot) => slot.startsAt.toISOString().startsWith('2027-03-22'))
    const afterDst = slots.find((slot) => slot.startsAt.toISOString().startsWith('2027-03-29'))

    expect(beforeDst?.startsAt.toISOString()).toBe('2027-03-22T09:00:00.000Z')
    expect(afterDst?.startsAt.toISOString()).toBe('2027-03-29T08:00:00.000Z')
  })

  test('T3.1 — fórmula completa: regra menos bloqueio, mais extra, menos reserva existente', async () => {
    const availabilityRepository = new AvailabilityRepository(db)
    const { resource, service } = await createResourceAndService({
      timezone: 'America/Sao_Paulo',
      durationMinutes: 60,
    })

    // Quarta-feira (weekday 3), regra 09:00–10:00 local (America/Sao_Paulo é UTC-3 o ano todo).
    await availabilityRepository.createRule({
      companyId,
      resourceId: resource.id,
      weekday: 3,
      startsAtLocal: '09:00',
      endsAtLocal: '10:00',
    })

    // Bloqueia a primeira quarta (2027-04-07) inteira.
    await availabilityRepository.createException({
      companyId,
      resourceId: resource.id,
      duringStart: new Date('2027-04-07T00:00:00Z'),
      duringEnd: new Date('2027-04-08T00:00:00Z'),
      kind: AVAILABILITY_EXCEPTION_KIND.BLOCK,
    })
    // Libera um horário extra fora da regra semanal, na quinta 2027-04-08, 14:00–15:00 local.
    await availabilityRepository.createException({
      companyId,
      resourceId: resource.id,
      duringStart: new Date('2027-04-08T17:00:00Z'),
      duringEnd: new Date('2027-04-08T18:00:00Z'),
      kind: AVAILABILITY_EXCEPTION_KIND.EXTRA,
    })
    // Reserva já existente ocupando a quarta seguinte (2027-04-14) 09:00–10:00 local.
    await bookingRepository.createWithSlots({
      booking: {
        companyId,
        title: 'Reserva existente',
        status: BOOKING_STATUS.CONFIRMED,
        startsAt: new Date('2027-04-14T12:00:00Z'),
        endsAt: new Date('2027-04-14T13:00:00Z'),
      },
      slots: [
        {
          resourceId: resource.id,
          duringStart: new Date('2027-04-14T12:00:00Z'),
          duringEnd: new Date('2027-04-14T13:00:00Z'),
          blockingStart: new Date('2027-04-14T12:00:00Z'),
          blockingEnd: new Date('2027-04-14T13:00:00Z'),
        },
      ],
    })

    const slots = await useCase.execute({
      companyId,
      resourceId: resource.id,
      serviceId: service.id,
      from: new Date('2027-04-06T00:00:00Z'),
      until: new Date('2027-04-15T00:00:00Z'),
    })

    // A quarta 07/04 sumiu (bloqueada), o extra de 08/04 apareceu, a quarta 14/04 sumiu (reservada).
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual(['2027-04-08T17:00:00.000Z'])
  })

  test('T3.4 — validFrom: ocorrência anterior à validade da regra não gera candidato', async () => {
    const availabilityRepository = new AvailabilityRepository(db)
    const { resource, service } = await createResourceAndService({
      timezone: 'America/Sao_Paulo',
      durationMinutes: 60,
    })

    // Quinta-feira (weekday 4); a regra só vale a partir de 2027-05-10 — a ocorrência de 06/05
    // (antes da validade) fica de fora, e a de 13/05 (depois) aparece.
    await availabilityRepository.createRule({
      companyId,
      resourceId: resource.id,
      weekday: 4,
      startsAtLocal: '09:00',
      endsAtLocal: '10:00',
      validFrom: new Date('2027-05-10T00:00:00Z'),
    })

    const slots = await useCase.execute({
      companyId,
      resourceId: resource.id,
      serviceId: service.id,
      from: new Date('2027-05-05T00:00:00Z'),
      until: new Date('2027-05-15T00:00:00Z'),
    })

    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual(['2027-05-13T12:00:00.000Z'])
  })

  // F-014: `listExceptionsByResourceInRange` prometia `[from, until)` desde a assinatura, mas
  // nunca filtrava — qualquer exceção `extra` do recurso virava candidato reservável em toda
  // consulta de disponibilidade, mesmo anos fora da janela pedida. Sem regra nenhuma no recurso
  // (só a exceção), o único jeito do slot aparecer é via `candidatesFromExtraExceptions`.
  test('F-014: exceção extra fora da janela pedida não aparece como slot disponível', async () => {
    const availabilityRepository = new AvailabilityRepository(db)
    const { resource, service } = await createResourceAndService({
      timezone: 'America/Sao_Paulo',
      durationMinutes: 60,
    })

    await availabilityRepository.createException({
      companyId,
      resourceId: resource.id,
      kind: AVAILABILITY_EXCEPTION_KIND.EXTRA,
      duringStart: new Date('2028-01-10T12:00:00Z'),
      duringEnd: new Date('2028-01-10T13:00:00Z'),
      reason: null,
    })

    const slots = await useCase.execute({
      companyId,
      resourceId: resource.id,
      serviceId: service.id,
      from: new Date('2027-05-01T00:00:00Z'),
      until: new Date('2027-05-08T00:00:00Z'),
    })

    expect(slots).toEqual([])
  })
})
