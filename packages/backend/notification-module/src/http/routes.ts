/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError } from '@adatechnology/notification-contracts'
import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { NotificationModule } from '../NotificationModule'
import { buildInboxRoutes } from './inboxRoutes'
import { buildManagementRoutes } from './managementRoutes'

export type CreateNotificationRoutesParams = {
  readonly module: NotificationModule
  readonly heartbeatSeconds?: number
  /**
   * Segredo do HMAC do webhook de recibo. **Ausente = a rota de webhook não é publicada** — a
   * alternativa (publicar aceitando qualquer payload) é o oposto de fail-closed (`security.md` §3).
   */
  readonly webhookSecret?: string
  /** Ligar sem `webhookSecret` é erro de composição, e falha no boot em vez de em produção. */
  readonly features?: { readonly webhooks?: boolean }
}

export function createNotificationRoutes(params: CreateNotificationRoutesParams): ModuleRouteTable {
  if (params.features?.webhooks && !params.webhookSecret) throw new ConfigMissingError('webhookSecret')

  const routes = [
    ...buildInboxRoutes({ module: params.module, heartbeatSeconds: params.heartbeatSeconds }),
    ...buildManagementRoutes({ module: params.module, webhookSecret: params.webhookSecret }),
  ]

  return params.webhookSecret ? routes : routes.filter((route) => !route.path.startsWith('/notification-webhooks'))
}
