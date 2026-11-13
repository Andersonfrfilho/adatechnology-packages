/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const MICROSOFT_CALENDAR_ERROR_CODES = {
  invalidConfiguration: 'MICROSOFT_CALENDAR_INVALID_CONFIGURATION',
  unauthorized: 'MICROSOFT_CALENDAR_UNAUTHORIZED',
  rateLimited: 'MICROSOFT_CALENDAR_RATE_LIMITED',
  unavailable: 'MICROSOFT_CALENDAR_UNAVAILABLE',
} as const

export type MicrosoftCalendarErrorCode =
  (typeof MICROSOFT_CALENDAR_ERROR_CODES)[keyof typeof MICROSOFT_CALENDAR_ERROR_CODES]

export class MicrosoftCalendarError extends Error {
  readonly name = 'MicrosoftCalendarError'

  constructor(
    readonly code: MicrosoftCalendarErrorCode,
    message: string,
  ) {
    super(message)
  }
}
