/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, EMAIL_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, EmailDriverPort, SendEmailParams } from '@adatechnology/notification-contracts'

import { isSmtpError, type SmtpTransportClient } from './SmtpTransportClient'

export type SmtpEmailProviderConfig = {
  readonly from: string
  /**
   * URL de conexão (`smtps://user:pass@host:port`). Em dev aponta para o Mailpit do
   * `docker-compose.yml` da raiz — e-mail nunca sai da máquina e é inspecionável.
   */
  readonly smtpUrl?: string
  /** Injeção de teste — presente, o `nodemailer` real nunca é importado. */
  readonly transportClient?: SmtpTransportClient
}

// Códigos de "usuário desconhecido" — o mais próximo que o SMTP tem de "apaga o token" do push.
const INVALID_TARGET_CODES = new Set([550, 551, 553])

function classifySmtpError(error: unknown): DeliveryAttemptResult {
  const responseCode = isSmtpError(error) ? error.responseCode : undefined
  if (responseCode === undefined) return { outcome: 'retriable', errorCode: 'smtp_unknown' }
  if (INVALID_TARGET_CODES.has(responseCode)) return { outcome: 'invalid_target', errorCode: `smtp_${responseCode}` }
  if (responseCode >= 500) return { outcome: 'permanent', errorCode: `smtp_${responseCode}` }
  if (responseCode >= 400) return { outcome: 'retriable', errorCode: `smtp_${responseCode}` }
  return { outcome: 'permanent', errorCode: `smtp_${responseCode}` }
}

async function initNodemailerTransport(config: SmtpEmailProviderConfig): Promise<SmtpTransportClient> {
  if (!config.smtpUrl) throw new ConfigMissingError('smtpUrl')

  const nodemailer = await import('nodemailer')
  return nodemailer.createTransport(config.smtpUrl)
}

export function createSmtpEmailProvider(config: SmtpEmailProviderConfig): EmailDriverPort {
  let clientPromise: Promise<SmtpTransportClient> | undefined

  function resolveClient(): Promise<SmtpTransportClient> {
    if (config.transportClient) return Promise.resolve(config.transportClient)
    clientPromise ??= initNodemailerTransport(config)
    return clientPromise
  }

  return {
    driver: EMAIL_DRIVER.SMTP,
    async send(params: SendEmailParams): Promise<DeliveryAttemptResult> {
      const client = await resolveClient()
      try {
        const result = await client.sendMail({
          from: config.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
        })

        // Servidor aceitou a conexão mas rejeitou o destinatário sem lançar erro — mesmo sinal de
        // endereço morto que um 550 lançado como exceção.
        if (result.accepted.length === 0 && result.rejected.length > 0) {
          return { outcome: 'invalid_target', errorCode: 'smtp_rejected' }
        }

        return { outcome: 'sent', providerMessageId: result.messageId }
      } catch (error) {
        return classifySmtpError(error)
      }
    },
  }
}
