/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * BOLA / API1 (T5.6): a inbox é objeto de uma pessoa, não só de um tenant. Estes testes usam as
 * rotas REAIS do módulo (não um dublê) contra repositórios em memória, e provam que trocar o id
 * na URL não dá acesso ao que é de outro usuário — nem de outra empresa.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { AuthContextResolverPort } from '@adatechnology/notification-contracts'

import { createNotificationFetchRouter } from './fetch'
import { createNotificationRoutes } from './routes'
import { NotificationRepository } from '../repositories/NotificationRepository'
import type { NotificationModule } from '../NotificationModule'
import {
  CountUnreadUseCase,
  DeleteNotificationUseCase,
  ListNotificationsUseCase,
  MarkAllAsReadUseCase,
  MarkAsReadUseCase,
} from '../use-cases/Inbox.use-cases'
import { createInMemoryNotifications } from '../testing/inMemoryRepositories'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()
const USER_ALICE = randomUUID()
const USER_BRUNO = randomUUID()

/**
 * `NotificationRepository` é uma classe concreta sobre Drizzle; aqui trocamos os métodos que a
 * inbox usa pelo dublê em memória, mantendo a MESMA superfície. O isolamento no nível do SQL já
 * é coberto por `repositories/isolation.test.ts` — o que este arquivo prova é que a rota não
 * contorna o escopo, passando `id` sem o dono.
 */
function buildInboxModule(store: ReturnType<typeof createInMemoryNotifications>): NotificationModule {
  const repository = {
    ...store,
    async list(query: { companyId: string; recipientUserId: string; perPage: number }) {
      const rows = store.rows.filter(
        (row) => row.companyId === query.companyId && row.recipientUserId === query.recipientUserId && !row.deletedAt,
      )
      return { rows, nextCursor: undefined }
    },
    async countUnread(params: { companyId: string; recipientUserId: string }) {
      return store.rows.filter(
        (row) =>
          row.companyId === params.companyId &&
          row.recipientUserId === params.recipientUserId &&
          !row.readAt &&
          !row.deletedAt,
      ).length
    },
    async markRead(params: { companyId: string; recipientUserId: string; id: string }) {
      const row = store.rows.find(
        (candidate) =>
          candidate.companyId === params.companyId &&
          candidate.recipientUserId === params.recipientUserId &&
          candidate.id === params.id &&
          !candidate.readAt,
      )
      if (row) row.readAt = new Date()
      return row
    },
    async markAllRead(params: { companyId: string; recipientUserId: string }) {
      const rows = store.rows.filter(
        (row) => row.companyId === params.companyId && row.recipientUserId === params.recipientUserId && !row.readAt,
      )
      for (const row of rows) row.readAt = new Date()
      return rows.length
    },
    async softDelete(params: { companyId: string; recipientUserId: string; id: string }) {
      const row = store.rows.find(
        (candidate) =>
          candidate.companyId === params.companyId &&
          candidate.recipientUserId === params.recipientUserId &&
          candidate.id === params.id &&
          !candidate.deletedAt,
      )
      if (row) row.deletedAt = new Date()
      return row !== undefined
    },
  } as unknown as NotificationRepository

  return {
    useCases: {
      listNotifications: new ListNotificationsUseCase(repository),
      countUnread: new CountUnreadUseCase(repository),
      markAsRead: new MarkAsReadUseCase(repository),
      markAllAsRead: new MarkAllAsReadUseCase(repository),
      deleteNotification: new DeleteNotificationUseCase(repository),
    },
  } as unknown as NotificationModule
}

function buildRouterFor(module: NotificationModule, auth: { companyId: string; userId: string }) {
  const authResolver: AuthContextResolverPort = {
    async resolve() {
      return { companyId: auth.companyId, userId: auth.userId, scopes: [] }
    },
  }
  return createNotificationFetchRouter({
    routes: createNotificationRoutes({ module }),
    basePath: '/v1',
    authResolver,
  })
}

async function seedNotification(
  store: ReturnType<typeof createInMemoryNotifications>,
  params: { companyId: string; recipientUserId: string },
) {
  return store.create({
    companyId: params.companyId,
    recipientUserId: params.recipientUserId,
    category: 'order_status',
    templateKey: 'order.shipped',
    title: 'Pedido enviado',
    body: 'Conteúdo privado do destinatário',
  })
}

describe('BOLA — notificação de outro usuário da MESMA empresa', () => {
  it('marcar como lida devolve 404, e a notificação alheia continua não lida', async () => {
    const store = createInMemoryNotifications()
    const notificationOfBruno = await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_BRUNO })
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_A, userId: USER_ALICE })

    const response = await router.handle(
      new Request(`http://localhost/v1/notifications/${notificationOfBruno.id}/read`, { method: 'PATCH' }),
    )

    // 404 e não 403: confirmar a existência do recurso já seria vazamento (spec §, errors.ts).
    expect(response.status).toBe(404)
    expect(store.rows[0]?.readAt).toBeNull()
  })

  it('excluir devolve 404 e não apaga nada', async () => {
    const store = createInMemoryNotifications()
    const notificationOfBruno = await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_BRUNO })
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_A, userId: USER_ALICE })

    const response = await router.handle(
      new Request(`http://localhost/v1/notifications/${notificationOfBruno.id}`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(404)
    expect(store.rows[0]?.deletedAt).toBeNull()
  })

  it('listar não devolve o que pertence a outro usuário', async () => {
    const store = createInMemoryNotifications()
    await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_BRUNO })
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_A, userId: USER_ALICE })

    const response = await router.handle(new Request('http://localhost/v1/notifications', { method: 'GET' }))
    const payload = (await response.json()) as { data: unknown[]; meta: { unreadCount: number } }

    expect(payload.data).toHaveLength(0)
    expect(payload.meta.unreadCount).toBe(0)
    expect(JSON.stringify(payload)).not.toContain('Conteúdo privado')
  })

  it('marcar todas como lidas não alcança a inbox alheia', async () => {
    const store = createInMemoryNotifications()
    await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_BRUNO })
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_A, userId: USER_ALICE })

    const response = await router.handle(new Request('http://localhost/v1/notifications/read-all', { method: 'POST' }))
    const payload = (await response.json()) as { data: { updated: number } }

    expect(payload.data.updated).toBe(0)
    expect(store.rows[0]?.readAt).toBeNull()
  })
})

describe('isolamento multiempresa nas rotas', () => {
  it('mesmo usuário, empresa diferente: não lê a notificação da outra empresa', async () => {
    const store = createInMemoryNotifications()
    const notificationInCompanyA = await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_ALICE })
    // Alice autenticada no contexto da empresa B — mesmo userId, tenant diferente.
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_B, userId: USER_ALICE })

    const readResponse = await router.handle(
      new Request(`http://localhost/v1/notifications/${notificationInCompanyA.id}/read`, { method: 'PATCH' }),
    )
    const listResponse = await router.handle(new Request('http://localhost/v1/notifications', { method: 'GET' }))
    const payload = (await listResponse.json()) as { data: unknown[] }

    expect(readResponse.status).toBe(404)
    expect(payload.data).toHaveLength(0)
  })
})

describe('o próprio dono continua com acesso', () => {
  it('lê, marca como lida e exclui a própria notificação', async () => {
    const store = createInMemoryNotifications()
    const own = await seedNotification(store, { companyId: COMPANY_A, recipientUserId: USER_ALICE })
    const router = buildRouterFor(buildInboxModule(store), { companyId: COMPANY_A, userId: USER_ALICE })

    const listResponse = await router.handle(new Request('http://localhost/v1/notifications', { method: 'GET' }))
    const listed = (await listResponse.json()) as { data: unknown[]; meta: { unreadCount: number } }
    expect(listed.data).toHaveLength(1)
    expect(listed.meta.unreadCount).toBe(1)

    const readResponse = await router.handle(
      new Request(`http://localhost/v1/notifications/${own.id}/read`, { method: 'PATCH' }),
    )
    expect(readResponse.status).toBe(200)
    expect(store.rows[0]?.readAt).not.toBeNull()

    const deleteResponse = await router.handle(
      new Request(`http://localhost/v1/notifications/${own.id}`, { method: 'DELETE' }),
    )
    expect(deleteResponse.status).toBe(204)
    expect(store.rows[0]?.deletedAt).not.toBeNull()
  })
})
