/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, isNull, lt, or, sql, type SQL } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { notifications, type NewNotificationRow, type NotificationRow } from '../schema/schema'
import { decodeNotificationCursor, encodeNotificationCursor } from './cursor'

// Exportadas para o teste de isolamento (T3.5) renderizar o SQL e provar, sem precisar de um
// Postgres real, que `company_id` está em toda condição — não só nos métodos de hoje, mas em
// qualquer refactor futuro que reuse estas funções em vez de escrever o `where` na mão de novo.
export function notificationOwnedByCondition(params: { companyId: string; recipientUserId: string; id: string }): SQL {
  return and(
    eq(notifications.companyId, params.companyId),
    eq(notifications.recipientUserId, params.recipientUserId),
    eq(notifications.id, params.id),
    isNull(notifications.deletedAt),
  )!
}

export function notificationInboxCondition(params: { companyId: string; recipientUserId: string }): SQL {
  return and(
    eq(notifications.companyId, params.companyId),
    eq(notifications.recipientUserId, params.recipientUserId),
    isNull(notifications.deletedAt),
  )!
}

export function notificationUnreadCondition(params: { companyId: string; recipientUserId: string }): SQL {
  return and(
    eq(notifications.companyId, params.companyId),
    eq(notifications.recipientUserId, params.recipientUserId),
    isNull(notifications.readAt),
    isNull(notifications.deletedAt),
  )!
}

export function notificationUnreadOwnedCondition(params: {
  companyId: string
  recipientUserId: string
  id: string
}): SQL {
  return and(
    eq(notifications.companyId, params.companyId),
    eq(notifications.recipientUserId, params.recipientUserId),
    eq(notifications.id, params.id),
    isNull(notifications.readAt),
    isNull(notifications.deletedAt),
  )!
}

export type ListNotificationsQuery = {
  readonly companyId: string
  readonly recipientUserId: string
  readonly category?: string
  readonly read?: boolean
  readonly cursor?: string
  readonly perPage: number
}

export type ListNotificationsPage = {
  readonly rows: NotificationRow[]
  readonly nextCursor?: string
}

// Toda cláusula abaixo carrega `eq(notifications.companyId, ...)` por construção — nenhum método
// deste repositório aceita id sem escopar por empresa (database.md, "Consistência e multiempresa").
export class NotificationRepository {
  constructor(private readonly db: NotificationDatabase) {}

  async create(values: NewNotificationRow): Promise<NotificationRow> {
    const [row] = await this.db.insert(notifications).values(values).returning()
    if (!row) throw new Error('notification-module: insert em notifications não retornou linha')
    return row
  }

  async findByDedupeKey(params: { companyId: string; dedupeKey: string }): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.companyId, params.companyId), eq(notifications.dedupeKey, params.dedupeKey)))
      .limit(1)
    return row
  }

  /**
   * Sem `recipientUserId`: uso interno do worker (`DispatchDelivery`, `ReceiveDeliveryReceipt`),
   * que já recebeu o `companyId` de um job/webhook confiável — não uma rota HTTP exposta ao
   * usuário final. `findById` (abaixo) é a versão BOLA-safe, para quem lê a própria inbox.
   */
  async findByIdForCompany(params: { companyId: string; id: string }): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.companyId, params.companyId), eq(notifications.id, params.id)))
      .limit(1)
    return row
  }

  // Escopado por `recipientUserId` além de `companyId`: ler notificação de outro usuário da
  // mesma empresa é o mesmo BOLA que ler de outra empresa — o objeto pertence à pessoa, não só
  // ao tenant.
  async findById(params: {
    companyId: string
    recipientUserId: string
    id: string
  }): Promise<NotificationRow | undefined> {
    const [row] = await this.db.select().from(notifications).where(notificationOwnedByCondition(params)).limit(1)
    return row
  }

  async list(query: ListNotificationsQuery): Promise<ListNotificationsPage> {
    const cursor = query.cursor ? decodeNotificationCursor(query.cursor) : undefined
    const conditions = [notificationInboxCondition(query)]
    if (query.category) conditions.push(eq(notifications.category, query.category))
    if (query.read !== undefined) {
      conditions.push(query.read ? sql`${notifications.readAt} is not null` : isNull(notifications.readAt))
    }
    if (cursor) {
      conditions.push(
        or(
          lt(notifications.createdAt, cursor.createdAt),
          and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id)),
        )!,
      )
    }

    // Busca uma linha a mais para saber se existe próxima página sem uma segunda query de count.
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(sql`${notifications.createdAt} desc`, sql`${notifications.id} desc`)
      .limit(query.perPage + 1)

    const hasNextPage = rows.length > query.perPage
    const page = hasNextPage ? rows.slice(0, query.perPage) : rows
    const lastRow = page[page.length - 1]
    const nextCursor = hasNextPage && lastRow ? encodeNotificationCursor(lastRow) : undefined

    return { rows: page, nextCursor }
  }

  async countUnread(params: { companyId: string; recipientUserId: string }): Promise<number> {
    const [result] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(notificationUnreadCondition(params))
    return result?.value ?? 0
  }

  async markRead(params: {
    companyId: string
    recipientUserId: string
    id: string
  }): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(notificationUnreadOwnedCondition(params))
      .returning()
    return row
  }

  async markAllRead(params: { companyId: string; recipientUserId: string }): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(notificationUnreadCondition(params))
      .returning({ id: notifications.id })
    return rows.length
  }

  async softDelete(params: { companyId: string; recipientUserId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .update(notifications)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(notificationOwnedByCondition(params))
      .returning({ id: notifications.id })
    return row !== undefined
  }

  /**
   * Sem filtro de empresa: retenção é manutenção de toda a tabela, não uma ação por tenant. O
   * `onDelete: 'cascade'` da FK em `deliveries` apaga o histórico de entrega junto, sem uma
   * segunda query.
   */
  async purgeExpired(params: { olderThan: Date }): Promise<number> {
    const rows = await this.db
      .delete(notifications)
      .where(lt(notifications.createdAt, params.olderThan))
      .returning({ id: notifications.id })
    return rows.length
  }

  async updateStatus(params: { companyId: string; id: string; status: string }): Promise<void> {
    await this.db
      .update(notifications)
      .set({ status: params.status, updatedAt: new Date() })
      .where(and(eq(notifications.companyId, params.companyId), eq(notifications.id, params.id)))
  }
}
