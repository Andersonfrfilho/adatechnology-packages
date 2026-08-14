/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Booking, BookingSlot, BookingStatus } from '@adatechnology/scheduling-contracts'

import type { BookingRow, BookingSlotRow } from '../schema/schema'

export function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    companyId: row.companyId,
    serviceId: row.serviceId,
    title: row.title,
    status: row.status as BookingStatus,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    customerRef: row.customerRef,
    organizerRef: row.organizerRef,
    meetingUrl: row.meetingUrl,
    externalCalendarId: row.externalCalendarId,
    notes: row.notes,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    reminderSentAt: row.reminderSentAt,
    idempotencyKey: row.idempotencyKey,
  }
}

export function toBookingSlot(row: BookingSlotRow): BookingSlot {
  return {
    id: row.id,
    bookingId: row.bookingId,
    resourceId: row.resourceId,
    during: { start: row.duringStart, end: row.duringEnd },
    blocking: { start: row.blockingStart, end: row.blockingEnd },
  }
}
