/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { REFRESH_COOKIE_SAME_SITE } from '@adatechnology/user-contracts'

import {
  buildClearRefreshTokenCookie,
  buildRefreshTokenCookie,
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
