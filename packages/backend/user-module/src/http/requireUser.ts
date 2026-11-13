/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { NotAuthenticatedError } from '@adatechnology/user-contracts'
import type { RequestContext } from '@adatechnology/module-http'

/**
 * `dispatchRoute` já recusou requisição sem identidade nas rotas de escopo `user`, então isto só
 * dispara se um handler for montado fora do despachante — existe para o handler tratar `userId`
 * como definido sem `!`.
 */
export function requireUser(context: RequestContext): string {
  if (!context.auth?.userId) throw new NotAuthenticatedError()
  return context.auth.userId
}
