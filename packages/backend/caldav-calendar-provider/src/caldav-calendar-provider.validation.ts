/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { CALDAV_CALENDAR_ERROR_CODES, CaldavCalendarError } from './caldav-calendar-provider.error'
import type { CaldavCalendarProviderConfig } from './caldav-calendar-provider.types'

function fail(code: keyof typeof CALDAV_CALENDAR_ERROR_CODES, message: string): never {
  throw new CaldavCalendarError(CALDAV_CALENDAR_ERROR_CODES[code], message)
}

export function validateProviderConfig(config: CaldavCalendarProviderConfig): void {
  if (!config.calendarUrl.trim() || !/^https?:\/\//.test(config.calendarUrl)) {
    fail('invalidConfiguration', 'CalDAV configuration is invalid')
  }
  if (!config.username.trim()) fail('invalidConfiguration', 'CalDAV configuration is invalid')
  if (!config.password.trim()) fail('invalidConfiguration', 'CalDAV configuration is invalid')
}
