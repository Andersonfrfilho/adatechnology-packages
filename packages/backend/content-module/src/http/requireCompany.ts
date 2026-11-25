/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CONTENT_ERROR_CODES, ContentError } from '@adatechnology/content-contracts'
import type { RequestContext } from '@adatechnology/module-http'

/** `dispatchRoute` já recusa rota de admin sem identidade; isto só garante o tipo para o handler. */
export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new ContentError('Rota exige contexto autenticado.', 401, CONTENT_ERROR_CODES.CONFIG_MISSING)
  }
  return context.auth.companyId
}
