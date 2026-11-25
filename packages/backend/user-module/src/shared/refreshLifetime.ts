/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { UserModuleConfig } from '@adatechnology/user-contracts'

import { DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS, DEFAULT_SESSION_REFRESH_EXPIRES_IN_SECONDS } from './constants'

/**
 * `rememberMe` ausente devolve a validade de sempre: quem não usa a opção não muda de comportamento.
 */
export function resolveRefreshExpiresInSeconds(params: {
  readonly config: Pick<UserModuleConfig, 'refreshToken'>
  readonly rememberMe?: boolean
}): number {
  const refresh = params.config.refreshToken
  const standard = refresh?.expiresInSeconds ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS
  if (params.rememberMe === true) return refresh?.rememberExpiresInSeconds ?? standard
  if (params.rememberMe === false) return refresh?.sessionExpiresInSeconds ?? DEFAULT_SESSION_REFRESH_EXPIRES_IN_SECONDS
  return standard
}
