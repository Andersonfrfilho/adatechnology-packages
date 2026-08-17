/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { SCHEDULING_ERROR_CODES, SchedulingError } from '@adatechnology/scheduling-contracts'
import type { RequestContext } from '@adatechnology/module-http'

export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new SchedulingError('Rota exige contexto autenticado.', 401, SCHEDULING_ERROR_CODES.CONFIG_MISSING)
  }
  return context.auth.companyId
}
