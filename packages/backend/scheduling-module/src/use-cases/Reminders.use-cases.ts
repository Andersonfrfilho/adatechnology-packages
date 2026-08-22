/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fase 6 — lembretes. Varredura, não job atrasado (spec §10): reagendar uma reserva depois de
 * enfileirar um lembrete atrasado deixaria o job apontando para o horário errado. `SweepDueReminders`
 * lê o estado atual a cada chamada, e `reminderSentAt` é o guarda de idempotência entre varreduras
 * concorrentes (T6.2) — a reivindicação atômica vive em `BookingRepository.claimDueReminders`.
 */

import { nowOf, runHook, type SchedulingDependencies } from './schedulingModule.types'

const DEFAULT_REMINDER_ADVANCE_MINUTES = 1440
const DEFAULT_CLAIM_LIMIT = 100

function resourceIdsOf(slots: readonly { resourceId: string }[]): readonly string[] {
  return slots.map((slot) => slot.resourceId)
}

export class SweepDueRemindersUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { limit?: number } = {}): Promise<{ processed: number }> {
    const { repositories, hooks, config } = this.dependencies
    const now = nowOf(this.dependencies)

    const claimed = await repositories.bookings.claimDueReminders({
      now,
      windowMinutes: config.reminderAdvanceMinutes ?? DEFAULT_REMINDER_ADVANCE_MINUTES,
      limit: params.limit ?? DEFAULT_CLAIM_LIMIT,
    })

    // L-004: `onBookingReminderDue` que falha não pode deixar o lembrete perdido para sempre —
    // `claimDueReminders` já marcou `reminderSentAt`, então aqui desfazemos a marcação das falhas
    // para a próxima varredura reivindicar de novo.
    const failedBookingIds: string[] = []
    for (const booking of claimed) {
      const slots = await repositories.bookings.findSlotsByBooking({ bookingId: booking.id })
      const succeeded = await runHook({
        dependencies: this.dependencies,
        name: 'onBookingReminderDue',
        run: () =>
          hooks?.onBookingReminderDue?.({
            companyId: booking.companyId,
            occurredAt: now,
            bookingId: booking.id,
            serviceId: booking.serviceId,
            resourceIds: resourceIdsOf(slots),
            during: { start: booking.startsAt, end: booking.endsAt },
            customerRef: booking.customerRef,
            organizerRef: booking.organizerRef,
          }),
      })
      if (!succeeded) failedBookingIds.push(booking.id)
    }

    if (failedBookingIds.length > 0) {
      await repositories.bookings.releaseFailedReminders({ ids: failedBookingIds })
    }

    return { processed: claimed.length - failedBookingIds.length }
  }
}
