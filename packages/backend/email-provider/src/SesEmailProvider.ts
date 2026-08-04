/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, EMAIL_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, EmailDriverPort, SendEmailParams } from '@adatechnology/notification-contracts'

import { isSesError, type SesSendClient } from './SesSendClient'

export type SesEmailProviderConfig = {
  readonly from: string
  readonly region?: string
  /** Injeção de teste — presente, o `@aws-sdk/client-sesv2` real nunca é importado. */
  readonly client?: SesSendClient
}

// SESv2ServiceException.name — só o que muda a decisão de retry.
const RETRIABLE_NAMES = new Set([
  'TooManyRequestsException',
  'LimitExceededException',
  'InternalServiceErrorException',
  'ConcurrentModificationException',
])

function classifySesError(error: unknown): DeliveryAttemptResult {
  if (!isSesError(error)) return { outcome: 'retriable', errorCode: 'ses_unknown' }
  if (RETRIABLE_NAMES.has(error.name)) return { outcome: 'retriable', errorCode: error.name }
  return { outcome: 'permanent', errorCode: error.name }
}

async function initSesClient(config: SesEmailProviderConfig): Promise<SesSendClient> {
  if (!config.region) throw new ConfigMissingError('region')

  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2')
  const sesClient = new SESv2Client({ region: config.region })

  return {
    async sendEmail(params) {
      const response = await sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: params.from,
          Destination: { ToAddresses: [params.to] },
          ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
          Content: {
            Simple: {
              Subject: { Data: params.subject },
              Body: { Html: { Data: params.html }, Text: { Data: params.text } },
            },
          },
        }),
      )
      return { messageId: response.MessageId }
    },
  }
}

export function createSesEmailProvider(config: SesEmailProviderConfig): EmailDriverPort {
  let clientPromise: Promise<SesSendClient> | undefined

  function resolveClient(): Promise<SesSendClient> {
    if (config.client) return Promise.resolve(config.client)
    clientPromise ??= initSesClient(config)
    return clientPromise
  }

  return {
    driver: EMAIL_DRIVER.SES,
    async send(params: SendEmailParams): Promise<DeliveryAttemptResult> {
      const client = await resolveClient()
      try {
        const result = await client.sendEmail({
          from: config.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
        })
        return { outcome: 'sent', providerMessageId: result.messageId }
      } catch (error) {
        return classifySesError(error)
      }
    },
  }
}
