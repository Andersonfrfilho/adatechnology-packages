/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * SEGURANÇA: as rotas `admin` (modelos, políticas) e `service` (envio) declaram escopo. Antes,
 * qualquer pessoa logada da empresa editava modelo de mensagem só por ter sessão.
 */

import { describe, expect, it } from 'bun:test'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

import type { NotificationModule } from '../NotificationModule'
import { createNotificationRoutes, DEFAULT_NOTIFICATION_ROUTE_SCOPES, NOTIFICATION_SCOPE } from './routes'

const stubModule = { useCases: {} } as unknown as NotificationModule

function routerWith(scopes: string[]) {
  return createModuleFetchRouter({
    routes: createNotificationRoutes({ module: stubModule }),
    basePath: '/v1',
    authResolver: {
      async resolve() {
        return { companyId: 'company', userId: 'user', scopes }
      },
    },
  })
}

describe('escopos das rotas de notificação', () => {
  it('toda rota admin/service declara escopo; rota da pessoa não', () => {
    for (const route of createNotificationRoutes({ module: stubModule })) {
      if (route.scope === 'admin') expect(route.requiredScopes).toEqual(DEFAULT_NOTIFICATION_ROUTE_SCOPES.admin)
      if (route.scope === 'service') expect(route.requiredScopes).toContain(NOTIFICATION_SCOPE.SEND)
      if (route.scope === 'user') expect(route.requiredScopes).toBeUndefined()
    }
  })

  it('pessoa sem notification:admin recebe 403 nos modelos', async () => {
    const response = await routerWith([]).handle(new Request('http://localhost/v1/notification-templates'))
    expect(response.status).toBe(403)
  })

  it('notification:admin passa da checagem de escopo', async () => {
    const response = await routerWith([NOTIFICATION_SCOPE.ADMIN]).handle(
      new Request('http://localhost/v1/notification-templates'),
    )
    expect([401, 403]).not.toContain(response.status)
  })

  it('o host pode trocar o vocabulário', () => {
    const routes = createNotificationRoutes({ module: stubModule, scopes: { admin: ['admin'] } })
    expect(routes.find((route) => route.scope === 'admin')?.requiredScopes).toEqual(['admin'])
  })
})
