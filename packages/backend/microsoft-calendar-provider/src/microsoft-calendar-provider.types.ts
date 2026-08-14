/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export type MicrosoftCalendarProviderConfig = {
  /**
   * Devolve um access token OAuth2 (Microsoft Identity Platform) válido no momento da chamada.
   * O fluxo de autorização (consent, refresh token) é responsabilidade do host — este provider é
   * um cliente stateless da API, não um gerenciador de credencial.
   */
  readonly getAccessToken: () => Promise<string>
  /** Id do calendário Microsoft onde os eventos são espelhados; omitido usa o calendário padrão. */
  readonly calendarId?: string
  /** Injeção para teste; produção usa o `fetch` global. */
  readonly fetchImpl?: typeof fetch
}
