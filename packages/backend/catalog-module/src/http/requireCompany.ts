/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CatalogError, CATALOG_ERROR_CODES } from '@adatechnology/catalog-contracts'
import type { RequestContext } from '@adatechnology/module-http'

/**
 * `dispatchRoute` já recusou requisição sem identidade nas rotas não-públicas, então isto só
 * dispara se alguém montar um handler fora do despachante. Existe para o handler tratar
 * `companyId` como definido sem `!` nem `?? ''` — o tipo garante, em vez de o handler confiar.
 */
export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new CatalogError('Rota exige contexto autenticado.', 401, CATALOG_ERROR_CODES.CONFIG_MISSING)
  }
  return context.auth.companyId
}
