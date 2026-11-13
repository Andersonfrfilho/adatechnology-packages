/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export type GoogleCalendarProviderConfig = {
  /** Id do calendário Google onde os eventos são espelhados (`primary` para o calendário padrão). */
  readonly calendarId: string
  /**
   * Devolve um access token OAuth2 válido no momento da chamada. O fluxo de autorização (consent
   * screen, refresh token) é responsabilidade do host — este provider é um cliente stateless da
   * API, não um gerenciador de credencial.
   */
  readonly getAccessToken: () => Promise<string>
  /** Injeção para teste; produção usa o `fetch` global. */
  readonly fetchImpl?: typeof fetch
}
