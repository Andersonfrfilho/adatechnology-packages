/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição de leitura/escrita alcançável por uma requisição vive aqui, como função pura
 * exportada — a mesma que o repositório chama e que o teste de isolamento renderiza (mesmo
 * padrão de `catalog-module/repositories/conditions.ts`).
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm'

import { users } from '../schema/schema'

/** `undefined` (single-tenant) casa com `company_id IS NULL`; string (multi-tenant) casa com `=`. */
export function userScopeCondition(companyId: string | undefined): SQL {
  return companyId === undefined ? isNull(users.companyId) : eq(users.companyId, companyId)
}

export function userOwnedByCondition(params: { companyId: string | undefined; id: string }): SQL {
  return and(userScopeCondition(params.companyId), eq(users.id, params.id), isNull(users.deletedAt))!
}

export function userListCondition(params: { companyId: string | undefined }): SQL {
  return and(userScopeCondition(params.companyId), isNull(users.deletedAt))!
}

export function userByEmailCondition(params: { companyId: string | undefined; email: string }): SQL {
  return and(userListCondition(params), eq(users.email, params.email))!
}

export function userByProviderExternalCondition(params: {
  companyId: string | undefined
  providerId: string
  externalId: string
}): SQL {
  return and(
    userListCondition(params),
    eq(users.providerId, params.providerId),
    eq(users.externalId, params.externalId),
  )!
}
