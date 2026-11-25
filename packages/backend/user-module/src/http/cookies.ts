/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo permanece agnóstico de transporte (`module-http` não conhece cookie), mas o refresh
 * token precisa viver em `HttpOnly` para não ficar acessível a script no navegador
 * (`security.md` §8) — isto é o encanamento mínimo, sem inventar um 4º mecanismo de extensão.
 */

import { REFRESH_COOKIE_SAME_SITE, type RefreshCookieSameSite } from '@adatechnology/user-contracts'

import { DEFAULT_REFRESH_COOKIE_NAME, DEFAULT_REFRESH_COOKIE_PATH } from '../shared/constants'

export const REFRESH_TOKEN_COOKIE_NAME = DEFAULT_REFRESH_COOKIE_NAME

/** Nome e caminho do cookie de uma instância. Ausentes = os padrões de sempre. */
export type RefreshCookieNaming = {
  readonly name?: string
  readonly path?: string
}

const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/
const COOKIE_PATH_PATTERN = /^\/[^;\s,]*$/

export function isValidRefreshCookieName(name: string): boolean {
  return COOKIE_NAME_PATTERN.test(name)
}

export function isValidRefreshCookiePath(path: string): boolean {
  return COOKIE_PATH_PATTERN.test(path)
}

/**
 * `Secure` sempre, em todos os valores: `SameSite=None` é recusado pelo navegador sem ele, e num
 * cookie de refresh trafegar em texto claro nunca foi opção.
 */
const SAME_SITE_ATTRIBUTE: Readonly<Record<RefreshCookieSameSite, string>> = {
  [REFRESH_COOKIE_SAME_SITE.LAX]: 'SameSite=Lax',
  [REFRESH_COOKIE_SAME_SITE.NONE]: 'SameSite=None',
  [REFRESH_COOKIE_SAME_SITE.STRICT]: 'SameSite=Strict',
}

function attributesFor(sameSite: RefreshCookieSameSite | undefined, path: string | undefined): string {
  const sameSiteAttribute = SAME_SITE_ATTRIBUTE[sameSite ?? REFRESH_COOKIE_SAME_SITE.LAX]
  return `Path=${path ?? DEFAULT_REFRESH_COOKIE_PATH}; HttpOnly; Secure; ${sameSiteAttribute}`
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

/**
 * A escolha "lembrar de mim" viaja no próprio valor do cookie (`m~<token>` / `s~<token>`), sem
 * segundo cookie nem coluna nova: o refresh sabe qual validade repetir ao rotacionar. O token cru
 * é hexadecimal, então `~` nunca aparece nele; cookie sem prefixo é o formato de sempre.
 */
const REMEMBER_PREFIX = 'm~'
const SESSION_PREFIX = 's~'

export type ParsedRefreshCookie = {
  readonly token: string
  /** `undefined` = cookie no formato antigo, sem escolha registrada. */
  readonly rememberMe: boolean | undefined
}

export function parseRefreshCookieValue(value: string): ParsedRefreshCookie {
  if (value.startsWith(REMEMBER_PREFIX)) return { token: value.slice(REMEMBER_PREFIX.length), rememberMe: true }
  if (value.startsWith(SESSION_PREFIX)) return { token: value.slice(SESSION_PREFIX.length), rememberMe: false }
  return { token: value, rememberMe: undefined }
}

export function buildRefreshTokenCookie(
  params: RefreshCookieNaming & {
    readonly token: string
    readonly maxAgeSeconds: number
    /** Ausente = `lax`, o comportamento de sempre. */
    readonly sameSite?: RefreshCookieSameSite
    /** Ausente = cookie persistente no formato de sempre; `false` = cookie de sessão (sem `Max-Age`). */
    readonly rememberMe?: boolean
  },
): string {
  const prefix = params.rememberMe === undefined ? '' : params.rememberMe ? REMEMBER_PREFIX : SESSION_PREFIX
  const value = encodeURIComponent(`${prefix}${params.token}`)
  const name = params.name ?? REFRESH_TOKEN_COOKIE_NAME
  const maxAge = params.rememberMe === false ? '' : `; Max-Age=${params.maxAgeSeconds}`
  return `${name}=${value}; ${attributesFor(params.sameSite, params.path)}${maxAge}`
}

/**
 * A limpeza repete os MESMOS atributos da emissão.
 *
 * O navegador só substitui um cookie por outro de nome, domínio e caminho iguais — e trata
 * `SameSite` diferente como cookie diferente. Limpar com `Lax` o que foi emitido com `None`
 * deixaria a sessão viva, e o logout responderia 204 sem ter desligado nada.
 */
export function buildClearRefreshTokenCookie(
  sameSite?: RefreshCookieSameSite,
  naming: RefreshCookieNaming = {},
): string {
  const name = naming.name ?? REFRESH_TOKEN_COOKIE_NAME
  return `${name}=; ${attributesFor(sameSite, naming.path)}; Max-Age=0`
}
