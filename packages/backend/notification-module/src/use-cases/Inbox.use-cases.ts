/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As cinco operações da inbox — CRUD fino sobre `NotificationRepository`, agrupadas num arquivo
 * só (mesmo padrão de `meta-whatsapp-module/use-cases/FlowGraph.use-cases.ts`). Toda operação
 * aqui já chega escopada por `companyId` + `recipientUserId` — quem valida que o `recipientUserId`
 * é o do usuário autenticado é a rota (via `AuthContextResolverPort`), não este arquivo.
 */

import {
  NotificationNotFoundError,
  type NotificationHooks,
  type NotificationSummary,
} from '@adatechnology/notification-contracts'
import type {
  ListNotificationsPage,
  ListNotificationsQuery,
  NotificationRepository,
} from '../repositories/NotificationRepository'
import type { NotificationRow } from '../schema/schema'

function toNotificationSummary(row: NotificationRow): NotificationSummary {
  return {
    id: row.id,
    category: row.category,
    templateKey: row.templateKey,
    title: row.title,
    body: row.body,
    payload: row.payload,
    status: row.status as NotificationSummary['status'],
    scheduledFor: row.scheduledFor?.toISOString(),
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(
    query: ListNotificationsQuery,
  ): Promise<{ data: NotificationSummary[]; nextCursor?: string; unreadCount: number }> {
    const [page, unreadCount]: [ListNotificationsPage, number] = await Promise.all([
      this.notifications.list(query),
      this.notifications.countUnread({ companyId: query.companyId, recipientUserId: query.recipientUserId }),
    ])
    return { data: page.rows.map(toNotificationSummary), nextCursor: page.nextCursor, unreadCount }
  }
}

export class CountUnreadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(params: { companyId: string; recipientUserId: string }): Promise<number> {
    return this.notifications.countUnread(params)
  }
}

export class MarkAsReadUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly hooks?: NotificationHooks,
  ) {}

  async execute(params: { companyId: string; recipientUserId: string; id: string }): Promise<NotificationSummary> {
    const row = await this.notifications.markRead(params)
    if (!row) throw new NotificationNotFoundError(params.id)

    await this.hooks?.onNotificationRead?.({
      companyId: params.companyId,
      occurredAt: new Date(),
      notificationId: row.id,
      recipientUserId: params.recipientUserId,
    })
    return toNotificationSummary(row)
  }
}

export class MarkAllAsReadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(params: { companyId: string; recipientUserId: string }): Promise<number> {
    return this.notifications.markAllRead(params)
  }
}

export class DeleteNotificationUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(params: { companyId: string; recipientUserId: string; id: string }): Promise<void> {
    const deleted = await this.notifications.softDelete(params)
    if (!deleted) throw new NotificationNotFoundError(params.id)
  }
}
