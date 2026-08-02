/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O status da notificação é derivado do status das suas `deliveries` — nunca setado direto por
 * fora dessa derivação, para não divergir do que de fato aconteceu em cada canal.
 */

import { NOTIFICATION_STATUS } from '@adatechnology/notification-contracts'
import type { NotificationStatus } from '@adatechnology/notification-contracts'

export function computeNotificationStatus(deliveryStatuses: readonly string[]): NotificationStatus {
  if (deliveryStatuses.length === 0) return NOTIFICATION_STATUS.DISPATCHED
  if (deliveryStatuses.some((status) => status === 'queued')) return NOTIFICATION_STATUS.QUEUED

  // `skipped` é uma decisão de negócio (preferência, supressão, canal fora da janela), não um
  // erro — só `failed` conta contra o agregado.
  const failedCount = deliveryStatuses.filter((status) => status === 'failed').length
  if (failedCount === 0) return NOTIFICATION_STATUS.DISPATCHED
  if (failedCount === deliveryStatuses.length) return NOTIFICATION_STATUS.FAILED
  return NOTIFICATION_STATUS.PARTIALLY_FAILED
}
