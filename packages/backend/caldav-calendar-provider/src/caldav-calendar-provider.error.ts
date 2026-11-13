/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const CALDAV_CALENDAR_ERROR_CODES = {
  invalidConfiguration: 'CALDAV_CALENDAR_INVALID_CONFIGURATION',
  unauthorized: 'CALDAV_CALENDAR_UNAUTHORIZED',
  rateLimited: 'CALDAV_CALENDAR_RATE_LIMITED',
  unavailable: 'CALDAV_CALENDAR_UNAVAILABLE',
} as const

export type CaldavCalendarErrorCode = (typeof CALDAV_CALENDAR_ERROR_CODES)[keyof typeof CALDAV_CALENDAR_ERROR_CODES]

export class CaldavCalendarError extends Error {
  readonly name = 'CaldavCalendarError'

  constructor(
    readonly code: CaldavCalendarErrorCode,
    message: string,
  ) {
    super(message)
  }
}
