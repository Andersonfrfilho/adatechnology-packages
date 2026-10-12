/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_ACCESS_CACHE_TTL_SECONDS,
  INFRA_ACCESS_STATUS,
  INFRA_ACCESS_TOKEN_INVALID_CACHE_TTL_SECONDS,
  type InfraAccessStatus,
} from '@adatechnology/railway-infra-contracts'

const ACCESS_STATUSES = Object.values(INFRA_ACCESS_STATUS) as readonly string[]

/** Cache e entrada nao confiavel: valor fora do vocabulario e miss. */
export function parseAccessStatus(raw: string | null): InfraAccessStatus | undefined {
  if (raw === null || !ACCESS_STATUSES.includes(raw)) return undefined
  return raw as InfraAccessStatus
}

/** `undefined` = nao cacheia: falha transitoria nao pode ficar gravada como veredito. */
export function resolveAccessCacheTtlSeconds(access: InfraAccessStatus): number | undefined {
  if (access === INFRA_ACCESS_STATUS.UNAVAILABLE) return undefined
  // Token invalido expira antes: quem corrige o token precisa ver o efeito logo.
  if (access === INFRA_ACCESS_STATUS.TOKEN_INVALID) return INFRA_ACCESS_TOKEN_INVALID_CACHE_TTL_SECONDS
  return INFRA_ACCESS_CACHE_TTL_SECONDS
}
