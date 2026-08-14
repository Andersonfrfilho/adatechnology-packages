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
})
