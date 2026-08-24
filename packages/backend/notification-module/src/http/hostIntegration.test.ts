/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Critério de aceite numérico da spec §13 e do ADR 0001 §3: montar as rotas num host custa
 * **≤ 25 linhas de cola**, contra as 1.353 que o quickcart escreveu para expor os use-cases do
 * `meta-whatsapp-module`.
 *
 * O teste não conta linhas de um arquivo de exemplo (que envelheceria em silêncio): ele EXECUTA
 * a integração mínima de ponta a ponta e prova que ela funciona. O bloco entre os marcadores é a
 * cola real do host.
 */

import { describe, expect, it } from 'bun:test'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import { randomUUID } from 'node:crypto'

import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import { createNotificationRoutes } from './routes'
import type { NotificationModule } from '../NotificationModule'
import { CountUnreadUseCase, ListNotificationsUseCase } from '../use-cases/Inbox.use-cases'
import type { NotificationRepository } from '../repositories/NotificationRepository'

const COMPANY_ID = randomUUID()
const USER_ID = randomUUID()

function buildModuleWithOneUnread(): NotificationModule {
  const repository = {
    async list() {
      return { rows: [], nextCursor: undefined }
    },
    async countUnread() {
      return 1
    },
  } as unknown as NotificationRepository

  return {
    useCases: {
      listNotifications: new ListNotificationsUseCase(repository),
      countUnread: new CountUnreadUseCase(repository),
    },
  } as unknown as NotificationModule
}

describe('integração mínima no host', () => {
  it('monta e responde com a cola que cabe no orçamento de 25 linhas', async () => {
    const module = buildModuleWithOneUnread()
    const authContextResolver: AuthContextResolverPort = {
      async resolve() {
        return { companyId: COMPANY_ID, userId: USER_ID, scopes: [] }
      },
    }

    // ─── início da cola do host ────────────────────────────────────────────────────────────
    const notificationHttp = createModuleFetchRouter({
      routes: createNotificationRoutes({ module }),
      basePath: '/v1',
      authResolver: authContextResolver,
    })
    // No quickcart isto vira uma linha em `infra/http/server.ts` (`router.mount(notificationHttp)`)
    // mais ~20 linhas em `Router.mount()`, delegando ao match/handle antes do 404.
    const handle = async (request: Request): Promise<Response> =>
      notificationHttp.match(request) ? notificationHttp.handle(request) : new Response(null, { status: 404 })
    // ─── fim da cola do host ──────────────────────────────────────────────────────────────

    const unread = await handle(new Request('http://localhost/v1/notifications/unread-count'))
    const unknown = await handle(new Request('http://localhost/v1/rota-do-host'))

    expect(unread.status).toBe(200)
    expect(await unread.json()).toEqual({ data: { unreadCount: 1 } })
    // O que não é do módulo passa reto, para o host tratar — `match` é o que torna a montagem
    // não-invasiva.
    expect(unknown.status).toBe(404)
  })

  it('as rotas saem de uma chamada só, sem o host declarar nenhuma', () => {
    const routes = createNotificationRoutes({ module: buildModuleWithOneUnread() })

    // Sem `webhookSecret` a rota de webhook não é publicada (fail-closed).
    expect(routes).toHaveLength(17)
    expect(routes.every((route) => route.operationId.length > 0)).toBe(true)
  })

  it('com segredo configurado, a rota de webhook entra na tabela', () => {
    const routes = createNotificationRoutes({ module: buildModuleWithOneUnread(), webhookSecret: 'segredo' })

    expect(routes).toHaveLength(18)
    expect(routes.some((route) => route.path.startsWith('/notification-webhooks'))).toBe(true)
  })

  it('ligar webhooks sem segredo falha no boot, não em produção', () => {
    expect(() =>
      createNotificationRoutes({ module: buildModuleWithOneUnread(), features: { webhooks: true } }),
    ).toThrow(/webhookSecret/)
  })
})
