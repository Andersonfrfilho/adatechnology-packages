/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comportamento de `SweepDueReminders` (Fase 6) contra o dublê em memória. T6.2: duas varreduras
 * concorrentes sobre o mesmo estado não emitem o lembrete duas vezes.
 */

import { describe, expect, it } from 'bun:test'

import type { ClockPort, SchedulingHooks, SchedulingModuleConfig } from '@adatechnology/scheduling-contracts'

import { createInMemoryBookings, createInMemoryResources } from '../testing/inMemoryRepositories'
import { SweepDueRemindersUseCase } from './Reminders.use-cases'
import type { SchedulingDependencies } from './schedulingModule.types'

const COMPANY_ID = 'company-1'
const NOW = new Date('2026-08-14T12:00:00.000Z')
const FIXED_CLOCK: ClockPort = { now: () => NOW }

function buildDependencies(options: { config?: Partial<SchedulingModuleConfig>; hooks?: SchedulingHooks } = {}) {
  const resources = createInMemoryResources()
  const bookings = createInMemoryBookings()

  const dependencies = {
    repositories: { resources, services: {}, availability: {}, bookings },
    config: { maxLookaheadDays: 60, ...options.config },
    hooks: options.hooks,
    clock: FIXED_CLOCK,
  } as unknown as SchedulingDependencies

  return { dependencies, bookings }
}

async function seedConfirmedBooking(
  bookings: ReturnType<typeof createInMemoryBookings>,
  overrides: { startsAt: Date; resourceIds?: string[] },
) {
  const { booking } = await bookings.createWithSlots({
    booking: {
      companyId: COMPANY_ID,
      serviceId: null,
      title: 'Corte de cabelo',
      status: 'confirmed',
      startsAt: overrides.startsAt,
      endsAt: new Date(overrides.startsAt.getTime() + 30 * 60_000),
    } as never,
    slots: (overrides.resourceIds ?? ['resource-1']).map((resourceId) => ({
      resourceId,
      duringStart: overrides.startsAt,
      duringEnd: new Date(overrides.startsAt.getTime() + 30 * 60_000),
      blockingStart: overrides.startsAt,
      blockingEnd: new Date(overrides.startsAt.getTime() + 30 * 60_000),
    })),
  })
  return booking
}

describe('SweepDueRemindersUseCase', () => {
  it('emite o lembrete e marca reminderSentAt para reserva confirmada dentro da janela', async () => {
    const events: unknown[] = []
    const { dependencies, bookings } = buildDependencies({
      config: { reminderAdvanceMinutes: 60 },
      hooks: { onBookingReminderDue: (event) => void events.push(event) },
    })
    const booking = await seedConfirmedBooking(bookings, {
      startsAt: new Date(NOW.getTime() + 30 * 60_000),
      resourceIds: ['resource-1', 'resource-2'],
    })

    const result = await new SweepDueRemindersUseCase(dependencies).execute()

    expect(result.processed).toBe(1)
    expect(bookings.rows[0]?.reminderSentAt).toEqual(NOW)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      companyId: COMPANY_ID,
      bookingId: booking.id,
      resourceIds: ['resource-1', 'resource-2'],
    })
  })

  it('ignora reserva fora da janela de antecedência', async () => {
    const { dependencies, bookings } = buildDependencies({ config: { reminderAdvanceMinutes: 60 } })
    await seedConfirmedBooking(bookings, { startsAt: new Date(NOW.getTime() + 4 * 60 * 60_000) })

    const result = await new SweepDueRemindersUseCase(dependencies).execute()

    expect(result.processed).toBe(0)
    expect(bookings.rows[0]?.reminderSentAt).toBeNull()
  })

  it('ignora reserva não confirmada', async () => {
    const { dependencies, bookings } = buildDependencies({ config: { reminderAdvanceMinutes: 60 } })
    const { booking } = await bookings.createWithSlots({
      booking: {
        companyId: COMPANY_ID,
        title: 'Reunião',
        status: 'requested',
        startsAt: new Date(NOW.getTime() + 10 * 60_000),
        endsAt: new Date(NOW.getTime() + 40 * 60_000),
      } as never,
      slots: [],
    })

    const result = await new SweepDueRemindersUseCase(dependencies).execute()

    expect(result.processed).toBe(0)
    expect(bookings.rows.find((row) => row.id === booking.id)?.reminderSentAt).toBeNull()
  })

  it('não repete lembrete já enviado', async () => {
    const { dependencies, bookings } = buildDependencies({ config: { reminderAdvanceMinutes: 60 } })
    await seedConfirmedBooking(bookings, { startsAt: new Date(NOW.getTime() + 10 * 60_000) })

    await new SweepDueRemindersUseCase(dependencies).execute()
    const second = await new SweepDueRemindersUseCase(dependencies).execute()

    expect(second.processed).toBe(0)
  })

  it('T6.2 — duas varreduras concorrentes não emitem o mesmo lembrete duas vezes', async () => {
    const events: unknown[] = []
    const { dependencies, bookings } = buildDependencies({
      config: { reminderAdvanceMinutes: 60 },
      hooks: { onBookingReminderDue: (event) => void events.push(event) },
    })
    await seedConfirmedBooking(bookings, { startsAt: new Date(NOW.getTime() + 10 * 60_000) })

    const useCase = new SweepDueRemindersUseCase(dependencies)
    const [first, second] = await Promise.all([useCase.execute(), useCase.execute()])

    expect(first.processed + second.processed).toBe(1)
    expect(events).toHaveLength(1)
  })
})
