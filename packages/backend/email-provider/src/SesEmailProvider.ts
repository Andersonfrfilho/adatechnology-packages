/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, EMAIL_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, EmailDriverPort, SendEmailParams } from '@adatechnology/notification-contracts'

import { AttachmentFetchError, fetchAttachments } from './fetchAttachments'
import { buildMimeMessage } from './buildMimeMessage'
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

    async sendRawEmail(params) {
      const response = await sesClient.send(new SendEmailCommand({ Content: { Raw: { Data: params.raw } } }))
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

      // `retriable` porque a causa costuma ser a URL assinada vencida ou o storage fora do ar — os
      // dois se resolvem numa nova tentativa, com assinatura nova.
      let attachments
      try {
        attachments = await fetchAttachments(params.attachments)
      } catch (error) {
        if (error instanceof AttachmentFetchError) return { outcome: 'retriable', errorCode: error.errorCode }
        throw error
      }

      try {
        /**
         * Sem anexo continua no caminho `Simple`, e nao no MIME montado a mao.
         *
         * Nao e otimizacao: o `Simple` deixa a AWS cuidar de codificacao de cabecalho, quebra de
         * linha e charset. Montar MIME quando nao precisa e assumir esse trabalho — e os bugs dele —
         * em todo e-mail do produto, para servir a minoria que leva arquivo.
         */
        const result =
          attachments.length === 0
            ? await client.sendEmail({
                from: config.from,
                to: params.to,
                subject: params.subject,
                html: params.html,
                text: params.text,
                replyTo: params.replyTo,
              })
            : await client.sendRawEmail({
                raw: buildMimeMessage({
                  from: config.from,
                  to: params.to,
                  subject: params.subject,
                  html: params.html,
                  text: params.text,
                  replyTo: params.replyTo,
                  attachments,
                }),
              })

        return { outcome: 'sent', providerMessageId: result.messageId }
      } catch (error) {
        return classifySesError(error)
      }
    },
  }
}
