/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo permanece agnóstico de transporte (`module-http` não conhece cookie), mas o refresh
 * token precisa viver em `HttpOnly` para não ficar acessível a script no navegador
 * (`security.md` §8) — isto é o encanamento mínimo, sem inventar um 4º mecanismo de extensão.
 */

export const REFRESH_TOKEN_COOKIE_NAME = 'user_refresh_token'

export function parseCookieHeader(header: string | undefined): Readonly<Record<string, string>> {
  if (!header) return {}
  const entries = header.split(';').map((pair) => {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) return undefined
    const name = pair.slice(0, separatorIndex).trim()
    const value = pair.slice(separatorIndex + 1).trim()
    return name ? ([name, decodeURIComponent(value)] as const) : undefined
  })
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== undefined))
}

export function buildRefreshTokenCookie(params: { readonly token: string; readonly maxAgeSeconds: number }): string {
  return `${REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(params.token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${params.maxAgeSeconds}`
}

export function buildClearRefreshTokenCookie(): string {
  return `${REFRESH_TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
