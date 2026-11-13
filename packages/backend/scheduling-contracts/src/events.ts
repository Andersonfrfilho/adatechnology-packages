/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Pontos de extensão do produto — política comercial (multa por no-show, sinal, comissão) nunca
 * vira `if` dentro do módulo, sempre um hook plugado aqui (spec §4).
 */

import type { BookingId, BookingStatus, CompanyId, ResourceId, ServiceId, TimeRange } from './scheduling.types'

export const SCHEDULING_EVENT = {
  BOOKING_REQUESTED: 'booking.requested',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_RESCHEDULED: 'booking.rescheduled',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_REMINDER_DUE: 'booking.reminder_due',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_NO_SHOW: 'booking.no_show',
} as const
export type SchedulingEvent = (typeof SCHEDULING_EVENT)[keyof typeof SCHEDULING_EVENT]

type BaseEvent = {
  readonly companyId: CompanyId
  readonly occurredAt: Date
}

type BaseBookingEvent = BaseEvent & {
  readonly bookingId: BookingId
  readonly serviceId?: ServiceId | null
  readonly resourceIds: readonly ResourceId[]
}

export type BookingRequestedEvent = BaseBookingEvent & { readonly status: BookingStatus }

export type BookingConfirmedEvent = BaseBookingEvent

/** Carrega a faixa **anterior** — sem ela o consumidor não avisa "mudou de X para Y" (T1.5). */
export type BookingRescheduledEvent = BaseBookingEvent & {
  readonly previousDuring: TimeRange
  readonly during: TimeRange
}

export type BookingCancelledEvent = BaseBookingEvent & {
  readonly cancelledBy: string
  readonly cancellationReason?: string | null
}

export type BookingReminderDueEvent = BaseBookingEvent & {
  readonly during: TimeRange
  readonly customerRef?: string | null
  readonly organizerRef?: string | null
}

export type BookingCompletedEvent = BaseBookingEvent

export type BookingNoShowEvent = BaseBookingEvent

/**
 * Hooks são `void`-tolerantes: falha de regra do produto não pode derrubar a operação de
 * agendamento. O módulo loga e segue.
 */
export type SchedulingHooks = {
  onBookingRequested?(event: BookingRequestedEvent): Promise<void> | void
  onBookingConfirmed?(event: BookingConfirmedEvent): Promise<void> | void
  onBookingRescheduled?(event: BookingRescheduledEvent): Promise<void> | void
  onBookingCancelled?(event: BookingCancelledEvent): Promise<void> | void
  onBookingReminderDue?(event: BookingReminderDueEvent): Promise<void> | void
  onBookingCompleted?(event: BookingCompletedEvent): Promise<void> | void
  onBookingNoShow?(event: BookingNoShowEvent): Promise<void> | void
}
