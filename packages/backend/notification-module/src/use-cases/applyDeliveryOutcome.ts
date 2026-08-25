/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Age sobre o `DeliveryAttemptResult` já classificado pelo driver — este arquivo nunca interpreta
 * código de erro de provedor, só reage ao discriminante (spec §6.3): `sent` grava o id;
 * `invalid_target` desativa device ou suprime endereço, sem retry; `retriable` reagenda com
 * backoff + jitter até esgotar `retryAttempts`; `permanent` finaliza na primeira tentativa.
 */

import { NOTIFICATION_CHANNEL, SUPPRESSION_REASON } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult } from '@adatechnology/notification-contracts'

import type { DeliveryAttachmentAudit, DeliveryRow, NotificationRow } from '../schema/schema'
import { computeNotificationStatus } from '../shared/notificationAggregateStatus'
import { hashTarget } from '../shared/targetPrivacy'
import type { DispatchDeliveryConfig, DispatchDeliveryDependencies } from './dispatchDelivery.types'

function computeBackoffSeconds(attempt: number, baseSeconds: number): number {
  const exponential = baseSeconds * 2 ** attempt
  // Jitter completo (0×–1×) — evita que um provider caído sincronize todos os retries no mesmo
  // segundo quando volta, o que recriaria o próprio pico que a rejeição estava sinalizando.
  return Math.round(exponential * Math.random())
}

async function recomputeNotificationStatus(params: {
  dependencies: DispatchDeliveryDependencies
  notification: NotificationRow
  now: Date
}): Promise<void> {
  const { dependencies, notification } = params
  const rows = await dependencies.deliveries.listByNotification({
    companyId: notification.companyId,
    notificationId: notification.id,
  })
  const status = computeNotificationStatus(rows.map((row) => row.status))
  await dependencies.notifications.updateStatus({ companyId: notification.companyId, id: notification.id, status })
  if (status !== 'queued') {
    await dependencies.hooks?.onNotificationDispatched?.({
      companyId: notification.companyId,
      occurredAt: params.now,
      notificationId: notification.id,
      status,
    })
  }
}

export async function applyDeliveryOutcome(params: {
  dependencies: DispatchDeliveryDependencies
  config: DispatchDeliveryConfig
  delivery: DeliveryRow
  /**
   * O que a tentativa levou anexado — gravado em TODO desfecho, e não só no sucesso: a pergunta da
   * auditoria ("que arquivo esse cliente recebeu?") tem uma irmã ("o que a gente tentou mandar?"),
   * e a segunda só se responde na entrega que falhou.
   */
  attachments?: readonly DeliveryAttachmentAudit[]
  notification: NotificationRow
  outcome: DeliveryAttemptResult
  /** Endereço em claro, só para canais com supressão — o próprio caller já o resolveu para chamar o driver. */
  address?: string
  now: Date
}): Promise<void> {
  const { dependencies, config, delivery, notification, outcome, attachments, now } = params
  const channel = delivery.channel as (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]

  if (outcome.outcome === 'sent') {
    await dependencies.deliveries.updateAttempt({
      companyId: notification.companyId,
      id: delivery.id,
      status: 'sent',
      providerMessageId: outcome.providerMessageId,
      sentAt: now,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    })
    await dependencies.hooks?.onDeliverySent?.({
      companyId: notification.companyId,
      occurredAt: now,
      notificationId: notification.id,
      deliveryId: delivery.id,
      channel,
      providerMessageId: outcome.providerMessageId,
      attempt: delivery.attempt,
    })
    await recomputeNotificationStatus({ dependencies, notification, now })
    return
  }

  if (outcome.outcome === 'retriable') {
    const nextAttempt = delivery.attempt + 1
    const exhausted = nextAttempt >= config.retryAttempts

    await dependencies.deliveries.updateAttempt({
      companyId: notification.companyId,
      id: delivery.id,
      status: exhausted ? 'failed' : 'queued',
      attempt: nextAttempt,
      errorCode: outcome.errorCode,
      failedAt: exhausted ? now : undefined,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    })
    await dependencies.hooks?.onDeliveryFailed?.({
      companyId: notification.companyId,
      occurredAt: now,
      notificationId: notification.id,
      deliveryId: delivery.id,
      channel,
      errorCode: outcome.errorCode,
      attempt: nextAttempt,
      willRetry: !exhausted,
    })

    if (exhausted) {
      await recomputeNotificationStatus({ dependencies, notification, now })
      return
    }

    const delaySeconds = outcome.retryAfterSeconds ?? computeBackoffSeconds(nextAttempt, config.retryBackoffSeconds)
    await dependencies.queue.enqueue({
      job: {
        notificationId: notification.id,
        deliveryId: delivery.id,
        companyId: notification.companyId,
        channel,
        attempt: nextAttempt,
      },
      delaySeconds,
    })
    // Ainda em voo — o agregado só é recalculado quando nenhuma delivery segue `queued`.
    return
  }

  // 'invalid_target' | 'permanent' — os dois finalizam a delivery; só o primeiro também apaga o
  // destino (device desativado ou endereço suprimido) para não gastar outra tentativa nele.
  if (outcome.outcome === 'invalid_target') {
    if (channel === NOTIFICATION_CHANNEL.PUSH && delivery.deviceId) {
      await dependencies.devices.disable({ id: delivery.deviceId, reason: outcome.errorCode })
      await dependencies.hooks?.onDeviceInvalidated?.({
        companyId: notification.companyId,
        occurredAt: now,
        deviceId: delivery.deviceId,
        userId: notification.recipientUserId,
        driver: (delivery.driver ?? 'unknown') as never,
        errorCode: outcome.errorCode,
      })
    } else if (params.address) {
      const reason = outcome.suppressionReason ?? SUPPRESSION_REASON.BOUNCE
      await dependencies.suppressions.create({
        companyId: notification.companyId,
        channel,
        targetHash: hashTarget({ address: params.address, key: config.suppressionHmacKey }),
        reason,
      })
      await dependencies.hooks?.onDeliveryBounced?.({
        companyId: notification.companyId,
        occurredAt: now,
        notificationId: notification.id,
        deliveryId: delivery.id,
        channel,
        reason,
      })
    }
  }

  await dependencies.deliveries.updateAttempt({
    companyId: notification.companyId,
    id: delivery.id,
    status: 'failed',
    errorCode: outcome.errorCode,
    failedAt: now,
    attempt: delivery.attempt + 1,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  })
  await dependencies.hooks?.onDeliveryFailed?.({
    companyId: notification.companyId,
    occurredAt: now,
    notificationId: notification.id,
    deliveryId: delivery.id,
    channel,
    errorCode: outcome.errorCode,
    attempt: delivery.attempt + 1,
    willRetry: false,
  })
  await recomputeNotificationStatus({ dependencies, notification, now })
}
