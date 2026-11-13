/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export type CaldavCalendarProviderConfig = {
  /** URL da coleção de calendário (ex.: `https://caldav.icloud.com/1234567/calendars/home/`), com barra final. */
  readonly calendarUrl: string
  /** Usuário para autenticação HTTP Basic — servidor iCloud usa senha de app dedicada. */
  readonly username: string
  readonly password: string
  /** Injeção para teste; produção usa o `fetch` global. */
  readonly fetchImpl?: typeof fetch
  /** Injeção para teste; produção usa `crypto.randomUUID`. Gera o UID do evento novo. */
  readonly generateUid?: () => string
}
