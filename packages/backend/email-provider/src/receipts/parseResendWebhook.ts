/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { SUPPRESSION_REASON } from '@adatechnology/notification-contracts'
import type { DeliveryReceipt } from '@adatechnology/notification-contracts'

/**
 * Formato documentado do webhook da Resend (`WebhookEvent`), reproduzido aqui por estrutura em
 * vez de importado do SDK — este arquivo só faz parsing de JSON, não precisa do cliente.
 */
type ResendWebhookPayload = {
  readonly type: string
  readonly created_at: string
  readonly data: {
    readonly email_id: string
    readonly bounce?: { readonly type?: string; readonly subType?: string }
  }
}

function isResendWebhookPayload(value: unknown): value is ResendWebhookPayload {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || typeof candidate.created_at !== 'string') return false
  const data = candidate.data as Record<string, unknown> | undefined
  return typeof data?.email_id === 'string'
}

/**
 * Traduz o evento assinado da Resend para o recibo normalizado do módulo. A verificação de
 * assinatura HMAC acontece **antes** desta função, sobre o `rawBody` — este parser já recebe o
 * JSON confiável.
 *
 * Devolve `undefined` para eventos que não mudam o estado de uma entrega (`email.sent`,
 * `email.opened`, `email.clicked`, ...) — o módulo simplesmente ignora o webhook.
 */
export function parseResendWebhook(payload: unknown): DeliveryReceipt | undefined {
  if (!isResendWebhookPayload(payload)) return undefined

  const occurredAt = new Date(payload.created_at)
  const providerMessageId = payload.data.email_id

  if (payload.type === 'email.delivered') {
    return { providerMessageId, status: 'delivered', occurredAt }
  }

  if (payload.type === 'email.bounced') {
    const errorCode = payload.data.bounce?.subType ?? payload.data.bounce?.type
    return { providerMessageId, status: 'bounced', suppressionReason: SUPPRESSION_REASON.BOUNCE, errorCode, occurredAt }
  }

  if (payload.type === 'email.complained') {
    return { providerMessageId, status: 'failed', suppressionReason: SUPPRESSION_REASON.COMPLAINT, occurredAt }
  }

  return undefined
}
