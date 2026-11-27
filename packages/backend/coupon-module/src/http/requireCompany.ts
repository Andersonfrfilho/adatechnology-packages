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
