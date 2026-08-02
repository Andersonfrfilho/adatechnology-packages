/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { SUPPRESSION_REASON } from '@adatechnology/notification-contracts'
import type { DeliveryReceipt } from '@adatechnology/notification-contracts'

/**
 * SES publica bounce/complaint/delivery via SNS: o corpo do POST é o envelope da SNS
 * (`Type`, `Message`), e `Message` é uma STRING com o evento da SES serializado dentro. Dois
 * `JSON.parse` em sequência, não um só — é a causa mais comum de parser de SES quebrado.
 *
 * A verificação da assinatura da SNS (certificado X.509, separada do HMAC do módulo) é
 * responsabilidade de quem expõe a rota; esta função só traduz o payload já autenticado.
 */
type SesEventMessage = {
  readonly notificationType: 'Bounce' | 'Complaint' | 'Delivery'
  readonly mail: { readonly messageId: string }
  readonly bounce?: { readonly bounceType: string; readonly bounceSubType: string; readonly timestamp: string }
  readonly complaint?: { readonly complaintFeedbackType?: string; readonly timestamp: string }
  readonly delivery?: { readonly timestamp: string }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isSesEventMessage(value: unknown): value is SesEventMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const mail = candidate.mail as Record<string, unknown> | undefined
  return (
    (candidate.notificationType === 'Bounce' ||
      candidate.notificationType === 'Complaint' ||
      candidate.notificationType === 'Delivery') &&
    typeof mail?.messageId === 'string'
  )
}

/** `undefined` para envelope malformado, confirmação de assinatura da SNS, ou tipo desconhecido. */
export function parseSesNotification(rawBody: string): DeliveryReceipt | undefined {
  const envelope = parseJson(rawBody) as { readonly Type?: string; readonly Message?: string } | undefined
  if (envelope?.Type !== 'Notification' || typeof envelope.Message !== 'string') return undefined

  const event = parseJson(envelope.Message)
  if (!isSesEventMessage(event)) return undefined

  const providerMessageId = event.mail.messageId

  if (event.notificationType === 'Delivery' && event.delivery) {
    return { providerMessageId, status: 'delivered', occurredAt: new Date(event.delivery.timestamp) }
  }

  if (event.notificationType === 'Bounce' && event.bounce) {
    return {
      providerMessageId,
      status: 'bounced',
      suppressionReason: SUPPRESSION_REASON.BOUNCE,
      errorCode: `${event.bounce.bounceType}/${event.bounce.bounceSubType}`,
      occurredAt: new Date(event.bounce.timestamp),
    }
  }

  if (event.notificationType === 'Complaint' && event.complaint) {
    return {
      providerMessageId,
      status: 'failed',
      suppressionReason: SUPPRESSION_REASON.COMPLAINT,
      errorCode: event.complaint.complaintFeedbackType,
      occurredAt: new Date(event.complaint.timestamp),
    }
  }

  return undefined
}
