/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { COUPON_ERROR_CODES, CouponError } from '@adatechnology/coupon-contracts'
import type { HttpResult, RequestContext } from '@adatechnology/module-http'

/** `dispatchRoute` já recusa rota de admin/serviço sem identidade; isto só garante o tipo. */
export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new CouponError('Rota exige contexto autenticado.', 401, COUPON_ERROR_CODES.CONFIG_MISSING)
  }
  return context.auth.companyId
}

export const json = (status: number, data: unknown): HttpResult => ({ kind: 'json', status, body: { data } })

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Parâmetro de caminho que tem de ser UUID. Inválido responde o mesmo 404 de "não existe": nem
 * vira 500 no Postgres (`invalid input syntax for type uuid`) nem diz ao chamador que o formato errou.
 */
export function uuidParam(context: RequestContext, name: string, notFound: (value: string) => Error): string {
  const value = context.params[name] ?? ''
  if (!UUID_PATTERN.test(value)) throw notFound(value)
  return value
}
