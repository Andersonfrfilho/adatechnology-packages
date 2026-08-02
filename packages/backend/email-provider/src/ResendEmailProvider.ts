/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, EMAIL_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, EmailDriverPort, SendEmailParams } from '@adatechnology/notification-contracts'

import type { ResendClientLike, ResendSendResult } from './ResendClient'

export type ResendEmailProviderConfig = {
  readonly from: string
  readonly apiKey?: string
  /** Injeção de teste — presente, o `resend` real nunca é importado. */
  readonly client?: ResendClientLike
}

// error.name documentado pela Resend (RESEND_ERROR_CODE_KEY). Sem sinal de "endereço não existe"
// — bounce é sempre assíncrono, via webhook (spec §11, "delivered é assimétrico").
const RETRIABLE_NAMES = new Set([
  'rate_limit_exceeded',
  'monthly_quota_exceeded',
  'daily_quota_exceeded',
  'internal_server_error',
  'application_error',
])

function classifyResendError(error: NonNullable<ResendSendResult['error']>): DeliveryAttemptResult {
  if (error.statusCode === 429 || (error.statusCode !== null && error.statusCode >= 500)) {
    return { outcome: 'retriable', errorCode: error.name }
  }
  if (RETRIABLE_NAMES.has(error.name)) return { outcome: 'retriable', errorCode: error.name }
  return { outcome: 'permanent', errorCode: error.name }
}

async function initResendClient(config: ResendEmailProviderConfig): Promise<ResendClientLike> {
  if (!config.apiKey) throw new ConfigMissingError('apiKey')

  const { Resend } = await import('resend')
  return new Resend(config.apiKey)
}

export function createResendEmailProvider(config: ResendEmailProviderConfig): EmailDriverPort {
  let clientPromise: Promise<ResendClientLike> | undefined

  function resolveClient(): Promise<ResendClientLike> {
    if (config.client) return Promise.resolve(config.client)
    clientPromise ??= initResendClient(config)
    return clientPromise
  }

  return {
    driver: EMAIL_DRIVER.RESEND,
    async send(params: SendEmailParams): Promise<DeliveryAttemptResult> {
      const client = await resolveClient()
      const result = await client.emails.send({
        from: config.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
      })

      if (result.error) return classifyResendError(result.error)
      return { outcome: 'sent', providerMessageId: result.data?.id }
    },
  }
}
