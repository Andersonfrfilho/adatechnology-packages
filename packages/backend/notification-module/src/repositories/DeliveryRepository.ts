/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { deliveries, type DeliveryAttachmentAudit, type DeliveryRow, type NewDeliveryRow } from '../schema/schema'

export type UpdateDeliveryAttemptParams = {
  readonly companyId: string
  readonly id: string
  readonly status: string
  readonly attempt?: number
  readonly providerMessageId?: string
  readonly errorCode?: string
  readonly sentAt?: Date
  readonly deliveredAt?: Date
  readonly failedAt?: Date
  /** Nome e tipo do que foi anexado. Ausente nao apaga o que ja estava gravado. */
  readonly attachments?: readonly DeliveryAttachmentAudit[]
}

export class DeliveryRepository {
  constructor(private readonly db: NotificationDatabase) {}

  async create(values: NewDeliveryRow): Promise<DeliveryRow> {
    const [row] = await this.db.insert(deliveries).values(values).returning()
    if (!row) throw new Error('notification-module: insert em deliveries não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<DeliveryRow | undefined> {
    const [row] = await this.db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.companyId, params.companyId), eq(deliveries.id, params.id)))
      .limit(1)
    return row
  }

  async listByNotification(params: { companyId: string; notificationId: string }): Promise<DeliveryRow[]> {
    return this.db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.companyId, params.companyId), eq(deliveries.notificationId, params.notificationId)))
  }

  async updateAttempt(params: UpdateDeliveryAttemptParams): Promise<DeliveryRow | undefined> {
    const [row] = await this.db
      .update(deliveries)
      .set({
        status: params.status,
        attempt: params.attempt,
        providerMessageId: params.providerMessageId,
        errorCode: params.errorCode,
        sentAt: params.sentAt,
        deliveredAt: params.deliveredAt,
        failedAt: params.failedAt,
        // Espalhado, e nao atribuido direto: `undefined` num `set` do Drizzle apagaria a coluna, e
        // toda tentativa seguinte (retry, recibo de entrega) zeraria o registro do anexo.
        ...(params.attachments ? { attachments: params.attachments } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(deliveries.companyId, params.companyId), eq(deliveries.id, params.id)))
      .returning()
    return row
  }

  /**
   * Sem `companyId`: o webhook de recibo chega só com o id que o provedor emitiu — é esta busca
   * que descobre a que empresa a entrega pertence. Não é um endpoint aberto ao cliente; só a
   * rota de webhook (autenticada por HMAC) chama este método (spec §5, comentário do índice
   * `idx_deliveries_provider_message`).
   */
  async findByProviderMessage(params: {
    channel: string
    providerMessageId: string
  }): Promise<DeliveryRow | undefined> {
    const [row] = await this.db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.channel, params.channel), eq(deliveries.providerMessageId, params.providerMessageId)))
      .limit(1)
    return row
  }
}
