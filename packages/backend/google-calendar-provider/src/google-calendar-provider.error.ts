/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const GOOGLE_CALENDAR_ERROR_CODES = {
  invalidConfiguration: 'GOOGLE_CALENDAR_INVALID_CONFIGURATION',
  unauthorized: 'GOOGLE_CALENDAR_UNAUTHORIZED',
  rateLimited: 'GOOGLE_CALENDAR_RATE_LIMITED',
  unavailable: 'GOOGLE_CALENDAR_UNAVAILABLE',
} as const

export type GoogleCalendarErrorCode = (typeof GOOGLE_CALENDAR_ERROR_CODES)[keyof typeof GOOGLE_CALENDAR_ERROR_CODES]

export class GoogleCalendarError extends Error {
  readonly name = 'GoogleCalendarError'

  constructor(
    readonly code: GoogleCalendarErrorCode,
    message: string,
  ) {
    super(message)
  }
}
