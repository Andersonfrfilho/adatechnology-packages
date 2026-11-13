/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  AvailabilityException,
  AvailabilityExceptionKind,
  AvailabilityRule,
  Booking,
  BookingSlot,
  BookingStatus,
  Resource,
  ResourceId,
  ResourceKind,
  Service,
} from '@adatechnology/scheduling-contracts'

import type {
  AvailabilityExceptionRow,
  AvailabilityRuleRow,
  BookingRow,
  BookingSlotRow,
  ResourceRow,
  ServiceRow,
} from '../schema/schema'

export function toResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    kind: row.kind as ResourceKind,
    timezone: row.timezone,
    externalRef: row.externalRef,
    active: row.active,
    deletedAt: row.deletedAt,
  }
}

export function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    durationMinutes: row.durationMinutes,
    bufferBeforeMinutes: row.bufferBeforeMinutes,
    bufferAfterMinutes: row.bufferAfterMinutes,
    priceInCents: row.priceInCents,
    requiresConfirmation: row.requiresConfirmation,
    minCancellationNoticeMinutes: row.minCancellationNoticeMinutes,
    active: row.active,
    sortOrder: row.sortOrder,
    deletedAt: row.deletedAt,
  }
}

export function toAvailabilityRule(row: AvailabilityRuleRow): AvailabilityRule {
  return {
    id: row.id,
    companyId: row.companyId,
    resourceId: row.resourceId,
    weekday: row.weekday,
    startsAtLocal: row.startsAtLocal,
    endsAtLocal: row.endsAtLocal,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  }
}

export function toAvailabilityException(row: AvailabilityExceptionRow): AvailabilityException {
  return {
    id: row.id,
    companyId: row.companyId,
    resourceId: row.resourceId,
    during: { start: row.duringStart, end: row.duringEnd },
    kind: row.kind as AvailabilityExceptionKind,
    reason: row.reason,
  }
}

export function toBooking(row: BookingRow, resourceIds: readonly ResourceId[]): Booking {
  return {
    id: row.id,
    companyId: row.companyId,
    serviceId: row.serviceId,
    title: row.title,
    status: row.status as BookingStatus,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    resourceIds,
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
