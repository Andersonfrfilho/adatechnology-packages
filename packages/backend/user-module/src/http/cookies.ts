/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo permanece agnóstico de transporte (`module-http` não conhece cookie), mas o refresh
 * token precisa viver em `HttpOnly` para não ficar acessível a script no navegador
 * (`security.md` §8) — isto é o encanamento mínimo, sem inventar um 4º mecanismo de extensão.
 */

import { REFRESH_COOKIE_SAME_SITE, type RefreshCookieSameSite } from '@adatechnology/user-contracts'

export const REFRESH_TOKEN_COOKIE_NAME = 'user_refresh_token'

/**
 * `Secure` sempre, nos dois valores: `SameSite=None` é recusado pelo navegador sem ele, e num
 * cookie de refresh trafegar em texto claro nunca foi opção.
 */
const ATTRIBUTES_BY_SAME_SITE: Readonly<Record<RefreshCookieSameSite, string>> = {
  [REFRESH_COOKIE_SAME_SITE.LAX]: 'Path=/; HttpOnly; Secure; SameSite=Lax',
  [REFRESH_COOKIE_SAME_SITE.NONE]: 'Path=/; HttpOnly; Secure; SameSite=None',
}

function attributesFor(sameSite: RefreshCookieSameSite | undefined): string {
  return ATTRIBUTES_BY_SAME_SITE[sameSite ?? REFRESH_COOKIE_SAME_SITE.LAX]
}

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

export function buildRefreshTokenCookie(params: {
  readonly token: string
  readonly maxAgeSeconds: number
  /** Ausente = `lax`, o comportamento de sempre. */
  readonly sameSite?: RefreshCookieSameSite
}): string {
  const value = encodeURIComponent(params.token)
  return `${REFRESH_TOKEN_COOKIE_NAME}=${value}; ${attributesFor(params.sameSite)}; Max-Age=${params.maxAgeSeconds}`
}

/**
 * A limpeza repete os MESMOS atributos da emissão.
 *
 * O navegador só substitui um cookie por outro de nome, domínio e caminho iguais — e trata
 * `SameSite` diferente como cookie diferente. Limpar com `Lax` o que foi emitido com `None`
 * deixaria a sessão viva, e o logout responderia 204 sem ter desligado nada.
 */
export function buildClearRefreshTokenCookie(sameSite?: RefreshCookieSameSite): string {
  return `${REFRESH_TOKEN_COOKIE_NAME}=; ${attributesFor(sameSite)}; Max-Age=0`
}
