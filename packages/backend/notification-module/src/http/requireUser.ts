/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { NotificationError, NOTIFICATION_ERROR_CODES } from '@adatechnology/notification-contracts'
import type { RequestContext } from '@adatechnology/module-http'

/**
 * `dispatchRoute` já recusou a requisição sem `auth` numa rota de escopo `user`, então este erro
 * só dispara se alguém montar um handler de escopo `user` fora do despachante. Existe para o
 * handler poder tratar `auth.userId` como definido sem `!` nem `?? ''` — o tipo garante, em vez
 * de o handler confiar.
 */
export function requireUser(context: RequestContext): { companyId: string; userId: string } {
  if (!context.auth?.userId) {
    throw new NotificationError('Rota exige usuário autenticado.', 401, NOTIFICATION_ERROR_CODES.CONFIG_MISSING)
  }
  return { companyId: context.auth.companyId, userId: context.auth.userId }
}
