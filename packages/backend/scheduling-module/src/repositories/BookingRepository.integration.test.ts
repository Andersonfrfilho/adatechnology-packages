/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres (T2.3): a constraint `booking_slot_no_overlap`
 * (`EXCLUDE USING gist`, spec §5.2) não tem equivalente em memória — só um índice GIST de
 * verdade detecta a sobreposição (ver limitação documentada em `testing/inMemoryRepositories.ts`).
 * Este teste roda a migração real pelo mesmo caminho de produção (`runSchedulingMigrations`) e
 * prova que o segundo `booking_slots` sobreposto no mesmo recurso vira `SlotUnavailableError`.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada — mesmo padrão de
 * `drizzle-provider`/`rabbitmq-provider`: Postgres não é pré-requisito para `bun test` local.
 * Migração é idempotente (tabela `scheduling_migrations` já marca o que rodou); a limpeza no
 * `afterAll` apaga só as linhas com o `companyId` gerado para esta suíte.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { SlotUnavailableError } from '@adatechnology/scheduling-contracts'

import type { SchedulingDatabase } from '../database.types'
import { bookings, resources } from '../schema/schema'
import { runSchedulingMigrations } from '../runMigrations'
import { BookingRepository } from './BookingRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('BookingRepository (integração Postgres real)', () => {
  const companyId = crypto.randomUUID()
  // F-013: só usado pela prova de cancelamento cross-tenant — precisa ser uma empresa de
  // verdade diferente de `companyId` para o `bookingOwnedByCondition` ter algo a rejeitar.
  const otherCompanyId = crypto.randomUUID()
  let sql: SQL
  let db: SchedulingDatabase
  let repository: BookingRepository
  let resourceId: string

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle(sql) as unknown as SchedulingDatabase
    await runSchedulingMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

    const [resource] = await db
      .insert(resources)
      .values({ companyId, name: 'Sala de teste de integração', kind: 'room', timezone: 'America/Sao_Paulo' })
      .returning()
    if (!resource) throw new Error('setup da suíte não conseguiu criar o recurso de teste')
    resourceId = resource.id
    repository = new BookingRepository(db)
  })

  afterAll(async () => {
    await db.delete(bookings).where(eq(bookings.companyId, companyId))
    await db.delete(resources).where(eq(resources.companyId, companyId))
    await sql.end()
  })

  test('F-013: cancelamento com companyId de outra empresa não apaga os slots nem cancela a reserva', async () => {
    const originalStart = new Date('2026-09-04T14:00:00Z')
    const originalEnd = new Date('2026-09-04T15:00:00Z')
    const { booking } = await repository.createWithSlots({
      booking: {
        companyId,
        title: 'Reunião G (alvo da tentativa de cancelamento cross-tenant)',
        status: 'confirmed',
        startsAt: originalStart,
        endsAt: originalEnd,
      },
      slots: [
        {
          resourceId,
          duringStart: originalStart,
          duringEnd: originalEnd,
          blockingStart: originalStart,
          blockingEnd: originalEnd,
        },
      ],
    })

    const result = await repository.cancelWithSlotRelease({
      companyId: otherCompanyId,
      id: booking.id,
      cancelledAt: new Date('2026-09-04T10:00:00Z'),
      cancelledBy: 'attacker',
    })
    expect(result).toBeUndefined()

    const bookingAfterAttempt = await repository.findById({ companyId, id: booking.id })
    expect(bookingAfterAttempt?.status).toBe('confirmed')
    expect(bookingAfterAttempt?.cancelledAt).toBeNull()

    const slotsAfterAttempt = await repository.findSlotsByBooking({ bookingId: booking.id })
    expect(slotsAfterAttempt).toHaveLength(1)
  })

  test('rejeita slot sobreposto no mesmo recurso com SlotUnavailableError', async () => {
    await repository.createWithSlots({
      booking: {
        companyId,
        title: 'Reunião A',
        status: 'confirmed',
        startsAt: new Date('2026-09-01T14:00:00Z'),
        endsAt: new Date('2026-09-01T15:00:00Z'),
      },
      slots: [
        {
          resourceId,
          duringStart: new Date('2026-09-01T14:00:00Z'),
          duringEnd: new Date('2026-09-01T15:00:00Z'),
          blockingStart: new Date('2026-09-01T14:00:00Z'),
          blockingEnd: new Date('2026-09-01T15:00:00Z'),
        },
      ],
    })

    await expect(
      repository.createWithSlots({
        booking: {
          companyId,
          title: 'Reunião B',
          status: 'confirmed',
          startsAt: new Date('2026-09-01T14:30:00Z'),
          endsAt: new Date('2026-09-01T15:30:00Z'),
        },
        slots: [
          {
            resourceId,
            duringStart: new Date('2026-09-01T14:30:00Z'),
            duringEnd: new Date('2026-09-01T15:30:00Z'),
            blockingStart: new Date('2026-09-01T14:30:00Z'),
            blockingEnd: new Date('2026-09-01T15:30:00Z'),
          },
        ],
      }),
    ).rejects.toThrow(SlotUnavailableError)
  })

  test('aceita slots ponta-a-ponta no mesmo recurso — bound "[)" não conflita', async () => {
    const { booking } = await repository.createWithSlots({
      booking: {
        companyId,
        title: 'Reunião C',
        status: 'confirmed',
        startsAt: new Date('2026-09-01T15:00:00Z'),
        endsAt: new Date('2026-09-01T16:00:00Z'),
      },
      slots: [
        {
          resourceId,
          duringStart: new Date('2026-09-01T15:00:00Z'),
          duringEnd: new Date('2026-09-01T16:00:00Z'),
          blockingStart: new Date('2026-09-01T15:00:00Z'),
          blockingEnd: new Date('2026-09-01T16:00:00Z'),
        },
      ],
    })

    expect(booking.id).toBeDefined()
  })

  // F-006: duas requisições concorrentes com a mesma `Idempotency-Key` — só um índice `unique`
  // de Postgres real prova que a corrida (23505) vira replay (`created: false`) em vez de erro.
  // Cada gravação usa um recurso próprio para que só o `unique` de idempotência possa conflitar,
  // nunca o `EXCLUDE` de sobreposição de slot (que já tem cobertura própria acima).
  test('duas gravações concorrentes com a mesma idempotencyKey: uma cria, a outra faz replay', async () => {
    const idempotencyKey = crypto.randomUUID()
    const [resourceA, resourceB] = await db
      .insert(resources)
      .values([
        { companyId, name: 'Recurso da corrida A', kind: 'room', timezone: 'America/Sao_Paulo' },
        { companyId, name: 'Recurso da corrida B', kind: 'room', timezone: 'America/Sao_Paulo' },
      ])
      .returning()
    if (!resourceA || !resourceB) throw new Error('setup do teste não conseguiu criar os recursos da corrida')

    const bookingFor = (title: string) => ({
      companyId,
      title,
      status: 'confirmed' as const,
      startsAt: new Date('2026-09-02T14:00:00Z'),
      endsAt: new Date('2026-09-02T15:00:00Z'),
      idempotencyKey,
    })
    const slotsFor = (resourceIdForSlot: string) => [
      {
        resourceId: resourceIdForSlot,
        duringStart: new Date('2026-09-02T14:00:00Z'),
        duringEnd: new Date('2026-09-02T15:00:00Z'),
        blockingStart: new Date('2026-09-02T14:00:00Z'),
        blockingEnd: new Date('2026-09-02T15:00:00Z'),
      },
    ]

    const [first, second] = await Promise.all([
      repository.createWithSlots({ booking: bookingFor('Reunião D (corrida 1)'), slots: slotsFor(resourceA.id) }),
      repository.createWithSlots({ booking: bookingFor('Reunião D (corrida 2)'), slots: slotsFor(resourceB.id) }),
    ])

    const [winner, loser] = first.created ? [first, second] : [second, first]
    expect(winner.created).toBe(true)
    expect(loser.created).toBe(false)
    expect(loser.booking.id).toBe(winner.booking.id)
  })

  // F-012: remarcação que esbarra no `EXCLUDE` real do Postgres precisa deixar a reserva
  // exatamente como estava antes — nunca sem slot, nunca com o horário novo gravado e o slot
  // velho apagado. Só um índice GIST de verdade dispara essa constraint; o dublê em memória não
  // tem como reproduzir esse caminho (mesma razão do teste de criação sobreposta acima).
  test('remarcação que esbarra no EXCLUDE não altera slots nem horário da reserva original', async () => {
    await repository.createWithSlots({
      booking: {
        companyId,
        title: 'Reunião E (ocupa o horário)',
        status: 'confirmed',
        startsAt: new Date('2026-09-03T14:00:00Z'),
        endsAt: new Date('2026-09-03T15:00:00Z'),
      },
      slots: [
        {
          resourceId,
          duringStart: new Date('2026-09-03T14:00:00Z'),
          duringEnd: new Date('2026-09-03T15:00:00Z'),
          blockingStart: new Date('2026-09-03T14:00:00Z'),
          blockingEnd: new Date('2026-09-03T15:00:00Z'),
        },
      ],
    })

    const originalStart = new Date('2026-09-03T16:00:00Z')
    const originalEnd = new Date('2026-09-03T17:00:00Z')
    const { booking: bookingToReschedule } = await repository.createWithSlots({
      booking: {
        companyId,
        title: 'Reunião F (vai tentar remarcar em cima da E)',
        status: 'confirmed',
        startsAt: originalStart,
        endsAt: originalEnd,
      },
      slots: [
        {
          resourceId,
          duringStart: originalStart,
          duringEnd: originalEnd,
          blockingStart: originalStart,
          blockingEnd: originalEnd,
        },
      ],
    })

    const conflictingStart = new Date('2026-09-03T14:30:00Z')
    const conflictingEnd = new Date('2026-09-03T15:30:00Z')
    await expect(
      repository.rescheduleWithSlotReplace({
        companyId,
        id: bookingToReschedule.id,
        status: 'confirmed',
        startsAt: conflictingStart,
        endsAt: conflictingEnd,
        slots: [
          {
            resourceId,
            duringStart: conflictingStart,
            duringEnd: conflictingEnd,
            blockingStart: conflictingStart,
            blockingEnd: conflictingEnd,
          },
        ],
      }),
    ).rejects.toThrow(SlotUnavailableError)

    const bookingAfterFailedReschedule = await repository.findById({ companyId, id: bookingToReschedule.id })
    expect(bookingAfterFailedReschedule?.startsAt).toEqual(originalStart)
    expect(bookingAfterFailedReschedule?.endsAt).toEqual(originalEnd)

    const slotsAfterFailedReschedule = await repository.findSlotsByBooking({ bookingId: bookingToReschedule.id })
    expect(slotsAfterFailedReschedule).toHaveLength(1)
    expect(slotsAfterFailedReschedule[0]?.duringStart).toEqual(originalStart)
    expect(slotsAfterFailedReschedule[0]?.duringEnd).toEqual(originalEnd)
  })

  // H-2: `list()` precisa ordenar de verdade no Postgres — um `sortBy`/`sortDirection` que só
  // muda a ordem da página já buscada (client-side) mente sobre o resto da coleção assim que ela
  // passa de uma página (`web.md` §7). Recurso isolado só para este teste, para o `resourceId`
  // filtrar fora as reservas das outras suítes que compartilham `companyId`.
  test('H-2: list() ordena no servidor por sortBy/sortDirection, não só a página buscada', async () => {
    const [sortResource] = await db
      .insert(resources)
      .values({ companyId, name: 'Sala do teste de ordenação', kind: 'room', timezone: 'America/Sao_Paulo' })
      .returning()
    if (!sortResource) throw new Error('setup do teste de ordenação não conseguiu criar o recurso')

    async function createSortTestBooking(title: string, startsAt: Date): Promise<void> {
      const endsAt = new Date(startsAt.getTime() + 30 * 60_000)
      await repository.createWithSlots({
        booking: { companyId, title, status: 'confirmed', startsAt, endsAt },
        slots: [
          {
            resourceId: sortResource.id,
            duringStart: startsAt,
            duringEnd: endsAt,
            blockingStart: startsAt,
            blockingEnd: endsAt,
          },
        ],
      })
    }

    await createSortTestBooking('Zebra', new Date('2026-09-10T09:00:00Z'))
    await createSortTestBooking('Abacaxi', new Date('2026-09-10T11:00:00Z'))
    await createSortTestBooking('Mango', new Date('2026-09-10T10:00:00Z'))

    const byTitleAsc = await repository.list({
      companyId,
      page: 1,
      pageSize: 20,
      resourceId: sortResource.id,
      sortBy: 'title',
      sortDirection: 'asc',
    })
    expect(byTitleAsc.rows.map((row) => row.title)).toEqual(['Abacaxi', 'Mango', 'Zebra'])

    const byTitleDesc = await repository.list({
      companyId,
      page: 1,
      pageSize: 20,
      resourceId: sortResource.id,
      sortBy: 'title',
      sortDirection: 'desc',
    })
    expect(byTitleDesc.rows.map((row) => row.title)).toEqual(['Zebra', 'Mango', 'Abacaxi'])

    const byDefault = await repository.list({
      companyId,
      page: 1,
      pageSize: 20,
      resourceId: sortResource.id,
    })
    expect(byDefault.rows.map((row) => row.title)).toEqual(['Zebra', 'Mango', 'Abacaxi'])
  })
})
