/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError } from '@adatechnology/notification-contracts'
import type { ModuleRoute, ModuleRouteTable } from '@adatechnology/module-http'

import type { NotificationModule } from '../NotificationModule'
import { buildInboxRoutes } from './inboxRoutes'
import { buildManagementRoutes } from './managementRoutes'

/**
 * Escopos padrão das rotas que não são da pessoa: `admin` (modelos, políticas de categoria) e
 * `service` (envio por máquina). O envio aceita os dois, porque quem administra também dispara.
 */
export const NOTIFICATION_SCOPE = {
  ADMIN: 'notification:admin',
  SEND: 'notification:send',
} as const
export type NotificationScope = (typeof NOTIFICATION_SCOPE)[keyof typeof NOTIFICATION_SCOPE]

export type NotificationRouteScopes = {
  /** Liberam as rotas `admin`. Basta um. */
  readonly admin?: readonly string[]
  /** Liberam a rota `service` de envio. Basta um. */
  readonly service?: readonly string[]
}

export const DEFAULT_NOTIFICATION_ROUTE_SCOPES = {
  admin: [NOTIFICATION_SCOPE.ADMIN],
  service: [NOTIFICATION_SCOPE.SEND, NOTIFICATION_SCOPE.ADMIN],
} as const satisfies Required<NotificationRouteScopes>

function withRequiredScopes(
  routes: readonly ModuleRoute[],
  scopes: NotificationRouteScopes | undefined,
): ModuleRoute[] {
  const admin = scopes?.admin ?? DEFAULT_NOTIFICATION_ROUTE_SCOPES.admin
  const service = scopes?.service ?? DEFAULT_NOTIFICATION_ROUTE_SCOPES.service
  return routes.map((route) => {
    if (route.scope === 'admin') return { ...route, requiredScopes: admin }
    if (route.scope === 'service') return { ...route, requiredScopes: service }
    return route
  })
}

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
  /** Chave pública VAPID para clientes Web Push (PWA) obterem via GET /push/vapid-public-key */
  readonly vapidPublicKey?: string
  /**
   * Escopos exigidos nas rotas `admin`/`service`. Padrão em `DEFAULT_NOTIFICATION_ROUTE_SCOPES`;
   * lista vazia aceita qualquer identidade com algum escopo.
   */
  readonly scopes?: NotificationRouteScopes
}

export function createNotificationRoutes(params: CreateNotificationRoutesParams): ModuleRouteTable {
  if (params.features?.webhooks && !params.webhookSecret) throw new ConfigMissingError('webhookSecret')

  const routes = [
    ...buildInboxRoutes({ module: params.module, heartbeatSeconds: params.heartbeatSeconds }),
    ...buildManagementRoutes({
      module: params.module,
      webhookSecret: params.webhookSecret,
      vapidPublicKey: params.vapidPublicKey,
    }),
  ]

  const mounted = params.webhookSecret
    ? routes
    : routes.filter((route) => !route.path.startsWith('/notification-webhooks'))
  return withRequiredScopes(mounted, params.scopes)
}
