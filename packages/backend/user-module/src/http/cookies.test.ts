/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { REFRESH_COOKIE_SAME_SITE } from '@adatechnology/user-contracts'

import {
  buildClearRefreshTokenCookie,
  buildRefreshTokenCookie,
  parseRefreshCookieValue,
  isValidRefreshCookieName,
  isValidRefreshCookiePath,
  parseCookieHeader,
  REFRESH_TOKEN_COOKIE_NAME,
} from './cookies'

const token = 'token-de-refresh'

describe('buildRefreshTokenCookie', () => {
  it('sem política declarada, continua `Lax` — o comportamento de sempre', () => {
    expect(buildRefreshTokenCookie({ token, maxAgeSeconds: 60 })).toBe(
      `${REFRESH_TOKEN_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`,
    )
  })

  it('emite `None` quando a tela vive em outro site registrável', () => {
    const cookie = buildRefreshTokenCookie({
      token,
      maxAgeSeconds: 60,
      sameSite: REFRESH_COOKIE_SAME_SITE.NONE,
    })

    expect(cookie).toContain('SameSite=None')
  })

  it('emite `Strict` quando o host pede', () => {
    const cookie = buildRefreshTokenCookie({
      token,
      maxAgeSeconds: 60,
      sameSite: REFRESH_COOKIE_SAME_SITE.STRICT,
    })

    expect(cookie).toContain('SameSite=Strict')
    expect(buildClearRefreshTokenCookie(REFRESH_COOKIE_SAME_SITE.STRICT)).toContain('SameSite=Strict')
  })

  it('`Secure` e `HttpOnly` nos dois valores — `None` é recusado sem `Secure`', () => {
    for (const sameSite of Object.values(REFRESH_COOKIE_SAME_SITE)) {
      const cookie = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, sameSite })

      expect(cookie).toContain('Secure')
      expect(cookie).toContain('HttpOnly')
    }
  })
})

describe('buildClearRefreshTokenCookie', () => {
  it('a limpeza repete os MESMOS atributos da emissão', () => {
    /*
     * O navegador trata `SameSite` diferente como cookie diferente: limpar com `Lax` o que foi
     * emitido com `None` deixaria a sessão viva, e o logout responderia 204 sem desligar nada.
     */
    for (const sameSite of Object.values(REFRESH_COOKIE_SAME_SITE)) {
      const issued = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, sameSite })
      const cleared = buildClearRefreshTokenCookie(sameSite)

      const attributesOf = (cookie: string) =>
        cookie
          .split('; ')
          .slice(1)
          .filter((attribute) => !attribute.startsWith('Max-Age'))

      expect(attributesOf(cleared)).toEqual(attributesOf(issued))
      expect(cleared).toContain('Max-Age=0')
    }
  })
})

describe('parseCookieHeader', () => {
  it('lê de volta o token que `buildRefreshTokenCookie` escreveu, com caractere que exige escape', () => {
    const raw = 'a+b/c=d'
    const [pair] = buildRefreshTokenCookie({ token: raw, maxAgeSeconds: 60 }).split('; ')

    expect(parseCookieHeader(pair)[REFRESH_TOKEN_COOKIE_NAME]).toBe(raw)
  })
})

describe('nome e caminho configuráveis do cookie', () => {
  it('nome e caminho próprios entram no cookie emitido e no de limpeza', () => {
    const naming = { name: 'staff_refresh', path: '/staff/auth' }

    const issued = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, ...naming })
    const cleared = buildClearRefreshTokenCookie(undefined, naming)

    expect(issued).toBe('staff_refresh=token-de-refresh; Path=/staff/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=60')
    expect(cleared).toBe('staff_refresh=; Path=/staff/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
  })

  it('duas instâncias na mesma origem emitem cookies de nomes diferentes — um não sobrescreve o outro', () => {
    const staff = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, name: 'staff_refresh' })
    const customers = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, name: 'customer_refresh' })

    const parsed = parseCookieHeader(`${staff.split('; ')[0]}; ${customers.split('; ')[0]}`)

    expect(Object.keys(parsed).sort()).toEqual(['customer_refresh', 'staff_refresh'])
  })

  it('só aceita nome e caminho que não permitem injetar atributo', () => {
    expect(isValidRefreshCookieName('staff_refresh-2')).toBe(true)
    expect(isValidRefreshCookieName('a=b')).toBe(false)
    expect(isValidRefreshCookieName('a; Domain=x')).toBe(false)
    expect(isValidRefreshCookieName('')).toBe(false)
    expect(isValidRefreshCookiePath('/staff/auth')).toBe(true)
    expect(isValidRefreshCookiePath('staff')).toBe(false)
    expect(isValidRefreshCookiePath('/a; Domain=x')).toBe(false)
  })
})

describe('lembrar de mim no cookie de refresh', () => {
  it('sem a escolha o cookie é exatamente o de sempre', () => {
    expect(buildRefreshTokenCookie({ token, maxAgeSeconds: 60 })).toBe(
      `${REFRESH_TOKEN_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`,
    )
  })

  it('lembrado: persistente (Max-Age); a escolha não vai no valor do cookie', () => {
    const cookie = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, rememberMe: true })
    expect(cookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=${token};`)
    expect(cookie).toContain('Max-Age=60')
  })

  it('não lembrado: cookie de sessão, sem Max-Age nem Expires', () => {
    const cookie = buildRefreshTokenCookie({ token, maxAgeSeconds: 60, rememberMe: false })
    expect(cookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=${token};`)
    expect(cookie).not.toContain('Max-Age')
    expect(cookie).not.toContain('Expires')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('o prefixo legado ainda é lido (cookie emitido antes do registro no servidor); sem prefixo não há dica', () => {
    expect(parseRefreshCookieValue(`m~${token}`)).toEqual({ token, rememberMe: true })
    expect(parseRefreshCookieValue(`s~${token}`)).toEqual({ token, rememberMe: false })
    expect(parseRefreshCookieValue(token)).toEqual({ token, rememberMe: undefined })
  })
})
