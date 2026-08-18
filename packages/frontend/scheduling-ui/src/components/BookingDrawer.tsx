/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { XCircle } from 'lucide-react'
import { useState } from 'react'
import { BOOKING_STATUS } from '@adatechnology/scheduling-contracts'
import type { Booking } from '@adatechnology/scheduling-contracts'

import { useCancelBooking, useCompleteBooking, useConfirmBooking, useMarkNoShow } from '../hooks/useBookingMutations.mutation'
import { useRescheduleBooking } from '../hooks/useRescheduleBooking.mutation'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { formatDateTimeLocalInTimeZone, parseDateTimeLocalInTimeZone } from './datetimeLocal.util'
import { SidePanel } from './SidePanel'

export type BookingDrawerProps = {
  readonly booking: Booking
  /** Fuso do recurso da reserva — ausente quando o recurso não foi resolvido (ex.: excluído). */
  readonly resourceTimezone?: string
  readonly onClose: () => void
}

// M-5 (T9.3): fallback para quando `resourceTimezone` não resolve — mesmo comportamento que o
// código tinha antes desta correção, nunca pior.
const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const ACTION_BUTTON_CLASS =
  'min-h-11 px-3 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
const PRIMARY_BUTTON_CLASS = 'min-h-11 px-3 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700'
const DANGER_BUTTON_CLASS =
  'inline-flex items-center gap-2 min-h-11 px-3 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50'
const INPUT_CLASS =
  'min-h-11 w-full px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm'

export function BookingDrawer({ booking, resourceTimezone, onClose }: BookingDrawerProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const confirmBooking = useConfirmBooking()
  const completeBooking = useCompleteBooking()
  const markNoShow = useMarkNoShow()
  const cancelBooking = useCancelBooking()
  const rescheduleBooking = useRescheduleBooking()
  const timezone = resourceTimezone ?? BROWSER_TIME_ZONE

  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelledBy, setCancelledBy] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [start, setStart] = useState(() => formatDateTimeLocalInTimeZone(booking.startsAt, timezone))
  const [end, setEnd] = useState(() => formatDateTimeLocalInTimeZone(booking.endsAt, timezone))

  async function handleCancel(): Promise<void> {
    if (!cancelledBy) return
    try {
      await cancelBooking.mutateAsync({
        id: booking.id,
        input: { cancelledBy, ...(cancellationReason ? { cancellationReason } : {}) },
      })
      onClose()
    } catch {
      // H-G: sem isto a rejeição sobe sem tratamento até o `onClick`, que não tem `.catch()` —
      // o alerta abaixo (cancelBooking.isError) já mostra a falha ao usuário.
    }
  }

  async function handleReschedule(): Promise<void> {
    try {
      await rescheduleBooking.mutateAsync({
        id: booking.id,
        input: {
          during: {
            start: parseDateTimeLocalInTimeZone(start, timezone),
            end: parseDateTimeLocalInTimeZone(end, timezone),
          },
        },
      })
      setIsRescheduling(false)
    } catch {
      // H-G: alerta abaixo (rescheduleBooking.isError) já mostra a falha ao usuário.
    }
  }

  const isTerminal =
    booking.status === BOOKING_STATUS.CANCELLED ||
    booking.status === BOOKING_STATUS.COMPLETED ||
    booking.status === BOOKING_STATUS.NO_SHOW

  return (
    <SidePanel title={messages['booking.detailTitle']} closeLabel={messages['common.close']} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{booking.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {messages[`booking.status.${booking.status === 'no_show' ? 'noShow' : booking.status}` as keyof typeof messages]}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {booking.startsAt.toLocaleString(locale)} → {booking.endsAt.toLocaleString(locale)}
          </p>
        </div>

        {(confirmBooking.isError ||
          completeBooking.isError ||
          markNoShow.isError ||
          cancelBooking.isError ||
          rescheduleBooking.isError) && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            {messages['common.actionFailure']}
          </p>
        )}

        {!isTerminal && (
          <div className="flex flex-wrap gap-2">
            {booking.status === BOOKING_STATUS.REQUESTED && (
              <button type="button" onClick={() => confirmBooking.mutate(booking.id)} className={PRIMARY_BUTTON_CLASS}>
                {messages['booking.confirm']}
              </button>
            )}
            {booking.status === BOOKING_STATUS.CONFIRMED && (
              <>
                <button type="button" onClick={() => completeBooking.mutate(booking.id)} className={ACTION_BUTTON_CLASS}>
                  {messages['booking.complete']}
                </button>
                <button type="button" onClick={() => markNoShow.mutate(booking.id)} className={ACTION_BUTTON_CLASS}>
                  {messages['booking.markNoShow']}
                </button>
                <button type="button" onClick={() => setIsRescheduling(true)} className={ACTION_BUTTON_CLASS}>
                  {messages['booking.reschedule']}
                </button>
              </>
            )}
            <button type="button" onClick={() => setIsCancelling(true)} className={DANGER_BUTTON_CLASS}>
              <XCircle aria-hidden="true" className="w-4 h-4" />
              {messages['booking.cancel']}
            </button>
          </div>
        )}

        {isRescheduling && (
          <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <input
              type="datetime-local"
              aria-label={messages['booking.rescheduleStart']}
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={INPUT_CLASS}
            />
            <input
              type="datetime-local"
              aria-label={messages['booking.rescheduleEnd']}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={INPUT_CLASS}
            />
            <button type="button" onClick={handleReschedule} disabled={rescheduleBooking.isPending} className={PRIMARY_BUTTON_CLASS}>
              {messages['common.save']}
            </button>
          </div>
        )}

        {isCancelling && (
          <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <input
              type="text"
              placeholder={messages['booking.cancelledBy']}
              value={cancelledBy}
              onChange={(event) => setCancelledBy(event.target.value)}
              className={INPUT_CLASS}
            />
            <input
              type="text"
              placeholder={messages['booking.cancelReason']}
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              className={INPUT_CLASS}
            />
            <button type="button" onClick={handleCancel} disabled={cancelBooking.isPending} className={DANGER_BUTTON_CLASS}>
              <XCircle aria-hidden="true" className="w-4 h-4" />
              {messages['booking.cancel']}
            </button>
          </div>
        )}
      </div>
    </SidePanel>
  )
}
