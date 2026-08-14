/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { MICROSOFT_CALENDAR_ERROR_CODES, MicrosoftCalendarError } from './microsoft-calendar-provider.error'
import type { MicrosoftCalendarProviderConfig } from './microsoft-calendar-provider.types'

function fail(code: keyof typeof MICROSOFT_CALENDAR_ERROR_CODES, message: string): never {
  throw new MicrosoftCalendarError(MICROSOFT_CALENDAR_ERROR_CODES[code], message)
}

export function validateProviderConfig(config: MicrosoftCalendarProviderConfig): void {
  if (typeof config.getAccessToken !== 'function') {
    fail('invalidConfiguration', 'Microsoft Calendar configuration is invalid')
  }
  if (config.calendarId !== undefined && !config.calendarId.trim()) {
    fail('invalidConfiguration', 'Microsoft Calendar configuration is invalid')
  }
}
