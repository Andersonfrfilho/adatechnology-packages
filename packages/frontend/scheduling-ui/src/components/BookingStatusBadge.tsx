/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O status era texto cinza na tabela e cor nenhuma na agenda: numa lista de vinte reservas, achar
 * a cancelada exigia ler linha por linha. A cor mora aqui para tabela, agenda e detalhe dizerem a
 * mesma coisa do mesmo jeito.
 */

import { BOOKING_STATUS, type BookingStatus } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages, type SchedulingMessages } from '../locales'

export type BookingStatusTone = {
  readonly badge: string
  readonly block: string
}

export const BOOKING_STATUS_TONE: Readonly<Record<BookingStatus, BookingStatusTone>> = {
  [BOOKING_STATUS.REQUESTED]: {
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    block: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100',
  },
  [BOOKING_STATUS.CONFIRMED]: {
    badge: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
    block: 'border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-600 dark:bg-brand-900/40 dark:text-brand-100',
  },
  [BOOKING_STATUS.CANCELLED]: {
    badge: 'bg-gray-200 text-gray-600 line-through dark:bg-gray-700 dark:text-gray-400',
    block: 'border-gray-300 bg-gray-100 text-gray-500 line-through dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  [BOOKING_STATUS.COMPLETED]: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    block: 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-100',
  },
  [BOOKING_STATUS.NO_SHOW]: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    block: 'border-red-400 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/40 dark:text-red-100',
  },
}

export function bookingStatusLabel(messages: SchedulingMessages, status: BookingStatus): string {
  const key = status === BOOKING_STATUS.NO_SHOW ? 'booking.status.noShow' : `booking.status.${status}`
  return messages[key as keyof SchedulingMessages]
}

export type BookingStatusBadgeProps = {
  readonly status: BookingStatus
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_STATUS_TONE[status].badge}`}
    >
      {bookingStatusLabel(messages, status)}
    </span>
  )
}
