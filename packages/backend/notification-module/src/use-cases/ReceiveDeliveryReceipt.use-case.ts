/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Processa o recibo já autenticado (a verificação HMAC + dedupe por nonce acontece na rota, não
 * aqui — ver `shared/webhookSecurity.ts`). `delivered`/`bounced`/`failed` é tudo que existe: a
 * assimetria entre canais (push confirma aceite, não entrega; e-mail e WhatsApp confirmam
 * entrega de verdade) é documentada no `email-provider`, não escondida aqui.
 */

import { NOTIFICATION_CHANNEL, SUPPRESSION_REASON } from '@adatechnology/notification-contracts'
import type { DeliveryReceipt, NotificationHooks, RecipientResolverPort } from '@adatechnology/notification-contracts'

import type { DeliveryRow, NotificationRow } from '../schema/schema'
import { hashTarget } from '../shared/targetPrivacy'

export type DeliveryReceiptFinder = {
  findByProviderMessage(params: { channel: string; providerMessageId: string }): Promise<DeliveryRow | undefined>
  updateAttempt(params: {
    companyId: string
    id: string
    status: string
    deliveredAt?: Date
    failedAt?: Date
    errorCode?: string
  }): Promise<DeliveryRow | undefined>
}

export type NotificationFinder = {
  findByIdForCompany(params: { companyId: string; id: string }): Promise<NotificationRow | undefined>
}

export type SuppressionWriter = {
  create(params: { companyId: string; channel: string; targetHash: string; reason: string }): Promise<unknown>
}

export type ReceiveDeliveryReceiptDependencies = {
  readonly deliveries: DeliveryReceiptFinder
  readonly notifications: NotificationFinder
  readonly suppressions: SuppressionWriter
  readonly recipientResolver: RecipientResolverPort
  readonly hooks?: NotificationHooks
  readonly logger?: { warn(message: string, meta?: Record<string, unknown>): void }
}

export class ReceiveDeliveryReceiptUseCase {
  constructor(
    private readonly dependencies: ReceiveDeliveryReceiptDependencies,
    private readonly config: { suppressionHmacKey: string },
  ) {}

  async execute(params: { channel: string; receipt: DeliveryReceipt }): Promise<void> {
    const { receipt } = params
    const delivery = await this.dependencies.deliveries.findByProviderMessage({
      channel: params.channel,
      providerMessageId: receipt.providerMessageId,
    })
    if (!delivery) {
      // Corrida (recibo chegou antes do commit da delivery) ou id de outro ambiente — não é erro
      // do chamador, então não lançamos; o provedor não deveria reenviar um 4xx de qualquer forma.
      this.dependencies.logger?.warn('notification.receive_delivery_receipt.not_found', {
        channel: params.channel,
        providerMessageId: receipt.providerMessageId,
      })
      return
    }

    const notification = await this.dependencies.notifications.findByIdForCompany({
      companyId: delivery.companyId,
      id: delivery.notificationId,
    })
    if (!notification) return

    if (receipt.status === 'delivered') {
      await this.dependencies.deliveries.updateAttempt({
        companyId: delivery.companyId,
        id: delivery.id,
        status: 'delivered',
        deliveredAt: receipt.occurredAt,
      })
      return
    }

    await this.dependencies.deliveries.updateAttempt({
      companyId: delivery.companyId,
      id: delivery.id,
      status: 'failed',
      failedAt: receipt.occurredAt,
      errorCode: receipt.errorCode,
    })

    if (receipt.status === 'bounced' && delivery.channel !== NOTIFICATION_CHANNEL.PUSH) {
      await this.suppressAddress({
        delivery,
        notification,
        reason: receipt.suppressionReason ?? SUPPRESSION_REASON.BOUNCE,
      })
    }

    await this.dependencies.hooks?.onDeliveryBounced?.({
      companyId: delivery.companyId,
      occurredAt: receipt.occurredAt,
      notificationId: delivery.notificationId,
      deliveryId: delivery.id,
      channel: delivery.channel as never,
      reason: receipt.suppressionReason ?? SUPPRESSION_REASON.BOUNCE,
    })
  }

  private async suppressAddress(params: {
    delivery: DeliveryRow
    notification: NotificationRow
    reason: string
  }): Promise<void> {
    const { delivery, notification } = params
    const recipient = await this.dependencies.recipientResolver.resolve({
      userId: notification.recipientUserId,
      companyId: delivery.companyId,
    })
    const address = delivery.channel === NOTIFICATION_CHANNEL.EMAIL ? recipient?.email : recipient?.phone
    if (!address) return // destinatário já não resolve mais o endereço — nada para suprimir

    await this.dependencies.suppressions.create({
      companyId: delivery.companyId,
      channel: delivery.channel,
      targetHash: hashTarget({ address, key: this.config.suppressionHmacKey }),
      reason: params.reason,
    })
  }
}
