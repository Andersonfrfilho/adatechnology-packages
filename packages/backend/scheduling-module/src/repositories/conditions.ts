/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição de leitura/escrita alcançável por uma requisição vive aqui, como **função pura
 * exportada** — e é a mesma função que o repositório chama e que o teste de isolamento renderiza.
 *
 * O ganho sobre escrever o `where` inline: um refactor que esqueça o filtro de empresa quebra o
 * teste na hora, porque o teste não reconstrói a lógica — ele exercita o código de produção.
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm'

import { availabilityExceptions, availabilityRules, bookings, resources, services } from '../schema/schema'

export function resourceOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(resources.companyId, params.companyId), eq(resources.id, params.id), isNull(resources.deletedAt))!
}

export function resourceListCondition(params: { companyId: string }): SQL {
  return and(eq(resources.companyId, params.companyId), isNull(resources.deletedAt))!
}

export function serviceOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(services.companyId, params.companyId), eq(services.id, params.id), isNull(services.deletedAt))!
}

export function serviceListCondition(params: { companyId: string }): SQL {
  return and(eq(services.companyId, params.companyId), isNull(services.deletedAt))!
}

export function availabilityRuleListCondition(params: { companyId: string; resourceId: string }): SQL {
  return and(eq(availabilityRules.companyId, params.companyId), eq(availabilityRules.resourceId, params.resourceId))!
}

export function availabilityExceptionListCondition(params: { companyId: string; resourceId: string }): SQL {
  return and(
    eq(availabilityExceptions.companyId, params.companyId),
    eq(availabilityExceptions.resourceId, params.resourceId),
  )!
}

export function bookingOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(bookings.companyId, params.companyId), eq(bookings.id, params.id))!
}

export function bookingListCondition(params: { companyId: string }): SQL {
  return eq(bookings.companyId, params.companyId)
}
