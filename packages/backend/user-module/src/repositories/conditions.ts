/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição de leitura/escrita alcançável por uma requisição vive aqui, como função pura
 * exportada — a mesma que o repositório chama e que o teste de isolamento renderiza (mesmo
 * padrão de `catalog-module/repositories/conditions.ts`).
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm'

import { DEFAULT_USER_AUDIENCE } from '@adatechnology/user-contracts'

import { users } from '../schema/schema'

/**
 * Escopo completo de uma instância: tenant + audiência. Toda leitura e escrita passa por aqui, então
 * uma instância nunca enxerga linha de outra audiência — nem pelo id.
 */
export type UserScope = {
  readonly companyId: string | undefined
  /** Ausente = `default`, a audiência de toda instância sem `config.audience`. */
  readonly audience?: string
}

/** `undefined` (single-tenant) casa com `company_id IS NULL`; string (multi-tenant) casa com `=`. */
export function userScopeCondition(companyId: string | undefined): SQL {
  return companyId === undefined ? isNull(users.companyId) : eq(users.companyId, companyId)
}

export function userOwnedByCondition(params: UserScope & { id: string }): SQL {
  return and(userListCondition(params), eq(users.id, params.id))!
}

export function userListCondition(params: UserScope): SQL {
  return and(
    userScopeCondition(params.companyId),
    eq(users.audience, params.audience ?? DEFAULT_USER_AUDIENCE),
    isNull(users.deletedAt),
  )!
}

export function userByEmailCondition(params: UserScope & { email: string }): SQL {
  return and(userListCondition(params), eq(users.email, params.email))!
}

/** Sem escopo de tenant, mas ainda dentro da audiência: posse de refresh token não cruza audiências. */
export function userByIdInAudienceCondition(params: { audience: string; id: string }): SQL {
  return and(
    eq(users.id, params.id),
    eq(users.audience, params.audience ?? DEFAULT_USER_AUDIENCE),
    isNull(users.deletedAt),
  )!
}

export function userByProviderExternalCondition(
  params: UserScope & {
    providerId: string
    externalId: string
  },
): SQL {
  return and(
    userListCondition(params),
    eq(users.providerId, params.providerId),
    eq(users.externalId, params.externalId),
  )!
}

export function userByPhoneCondition(params: UserScope & { phone: string }): SQL {
  return and(userListCondition(params), eq(users.phone, params.phone))!
}
