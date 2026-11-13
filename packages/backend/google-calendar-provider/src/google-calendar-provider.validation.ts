/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { GOOGLE_CALENDAR_ERROR_CODES, GoogleCalendarError } from './google-calendar-provider.error'
import type { GoogleCalendarProviderConfig } from './google-calendar-provider.types'

function fail(code: keyof typeof GOOGLE_CALENDAR_ERROR_CODES, message: string): never {
  throw new GoogleCalendarError(GOOGLE_CALENDAR_ERROR_CODES[code], message)
}

export function validateProviderConfig(config: GoogleCalendarProviderConfig): void {
  if (!config.calendarId.trim()) fail('invalidConfiguration', 'Google Calendar configuration is invalid')
  if (typeof config.getAccessToken !== 'function') {
    fail('invalidConfiguration', 'Google Calendar configuration is invalid')
  }
}
