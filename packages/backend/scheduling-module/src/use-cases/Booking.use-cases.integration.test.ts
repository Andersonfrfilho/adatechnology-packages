/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres (T4.1/T4.2) — a constraint `booking_slot_no_overlap`
 * (`EXCLUDE USING gist`, spec §5.2) não tem equivalente em memória (ver limitação documentada em
 * `testing/inMemoryRepositories.ts`). `BookingRepository.integration.test.ts` já prova a tradução
 * da violação em `SlotUnavailableError` na camada de repositório; este arquivo prova o mesmo fim a
 * fim por `RequestBookingUseCase`, incluindo o cenário de reunião (T4.2): dois compromissos que só
 * compartilham **um** recurso em comum devem colidir por causa dele, mesmo que os demais recursos
 * de cada reunião estejam livres — e a reunião que falha não deixa rastro (transação única, T4.5).
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { RESOURCE_KIND, SlotUnavailableError } from '@adatechnology/scheduling-contracts'

import type { SchedulingDatabase } from '../database.types'
import { AvailabilityRepository } from '../repositories/AvailabilityRepository'
import { BookingRepository } from '../repositories/BookingRepository'
import { ResourceRepository } from '../repositories/ResourceRepository'
import { ServiceRepository } from '../repositories/ServiceRepository'
import { runSchedulingMigrations } from '../runMigrations'
import { bookings, resources } from '../schema/schema'
import { RequestBookingUseCase } from './Booking.use-cases'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('RequestBookingUseCase (integração Postgres real)', () => {
  const companyId = crypto.randomUUID()
  let sql: SQL
  let db: SchedulingDatabase
  let resourceRepository: ResourceRepository
  let bookingRepository: BookingRepository
  let useCase: RequestBookingUseCase

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle(sql) as unknown as SchedulingDatabase
    await runSchedulingMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

    resourceRepository = new ResourceRepository(db)
    bookingRepository = new BookingRepository(db)
    useCase = new RequestBookingUseCase({
      repositories: {
        resources: resourceRepository,
        services: new ServiceRepository(db),
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

  async function createResource(name: string) {
    return resourceRepository.create({ companyId, name, kind: RESOURCE_KIND.ROOM, timezone: 'America/Sao_Paulo' })
  }

  test('T4.1 — duas reservas simultâneas do mesmo recurso: a segunda falha com SlotUnavailableError', async () => {
    const resource = await createResource('Sala T4.1')
    const during = { start: new Date('2027-06-01T14:00:00Z'), end: new Date('2027-06-01T15:00:00Z') }

    const { booking: first } = await useCase.execute({
      companyId,
      input: { title: 'Corte — cliente A', during, resourceIds: [resource.id] },
    })
    expect(first.id).toBeDefined()

    await expect(
      useCase.execute({
        companyId,
        input: {
          title: 'Corte — cliente B',
          during: { start: new Date('2027-06-01T14:30:00Z'), end: new Date('2027-06-01T15:30:00Z') },
          resourceIds: [resource.id],
        },
      }),
    ).rejects.toThrow(SlotUnavailableError)

    const confirmedFirst = await bookingRepository.findById({ companyId, id: first.id })
    expect(confirmedFirst?.status).toBe('confirmed')
  })

  test('T4.2 — duas reuniões que só compartilham um recurso colidem por causa dele', async () => {
    const shared = await createResource('Sala compartilhada T4.2')
    const onlyInMeetingA = await createResource('Sala exclusiva A T4.2')
    const onlyInMeetingB = await createResource('Sala exclusiva B T4.2')
    const during = { start: new Date('2027-06-02T16:00:00Z'), end: new Date('2027-06-02T17:00:00Z') }
    const overlappingDuring = { start: new Date('2027-06-02T16:30:00Z'), end: new Date('2027-06-02T17:30:00Z') }

    const { booking: meetingA } = await useCase.execute({
      companyId,
      input: { title: 'Reunião A', during, resourceIds: [shared.id, onlyInMeetingA.id] },
    })

    await expect(
      useCase.execute({
        companyId,
        input: {
          title: 'Reunião B',
          during: overlappingDuring,
          resourceIds: [onlyInMeetingB.id, shared.id],
        },
      }),
    ).rejects.toThrow(SlotUnavailableError)

    const slotsOfMeetingA = await bookingRepository.findSlotsByBooking({ bookingId: meetingA.id })
    expect(slotsOfMeetingA.map((slot) => slot.resourceId).sort()).toEqual([onlyInMeetingA.id, shared.id].sort())

    const onlyInMeetingBBlockingSlots = await bookingRepository.listBlockingSlotsByResource({
      resourceId: onlyInMeetingB.id,
      from: overlappingDuring.start,
      until: overlappingDuring.end,
    })
    expect(onlyInMeetingBBlockingSlots).toHaveLength(0)
  })

  test('reuniões no mesmo horário sem recurso em comum não colidem', async () => {
    const resourceForMeetingC = await createResource('Sala C T4.2')
    const resourceForMeetingD = await createResource('Sala D T4.2')
    const during = { start: new Date('2027-06-03T18:00:00Z'), end: new Date('2027-06-03T19:00:00Z') }

    const { booking: meetingC } = await useCase.execute({
      companyId,
      input: { title: 'Reunião C', during, resourceIds: [resourceForMeetingC.id] },
    })
    const { booking: meetingD } = await useCase.execute({
      companyId,
      input: { title: 'Reunião D', during, resourceIds: [resourceForMeetingD.id] },
    })

    expect(meetingC.id).not.toBe(meetingD.id)
  })
})
