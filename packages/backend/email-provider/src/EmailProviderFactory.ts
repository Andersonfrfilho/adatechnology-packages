/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { EMAIL_DRIVER } from '@adatechnology/notification-contracts'
import type { EmailDriverPort } from '@adatechnology/notification-contracts'

import { createResendEmailProvider, type ResendEmailProviderConfig } from './ResendEmailProvider'
import { createSesEmailProvider, type SesEmailProviderConfig } from './SesEmailProvider'
import { createSmtpEmailProvider, type SmtpEmailProviderConfig } from './SmtpEmailProvider'

export type CreateEmailProviderParams =
  | ({ readonly driver: typeof EMAIL_DRIVER.SMTP } & SmtpEmailProviderConfig)
  | ({ readonly driver: typeof EMAIL_DRIVER.RESEND } & ResendEmailProviderConfig)
  | ({ readonly driver: typeof EMAIL_DRIVER.SES } & SesEmailProviderConfig)

export function createEmailProvider(params: CreateEmailProviderParams): EmailDriverPort {
  if (params.driver === EMAIL_DRIVER.SMTP) return createSmtpEmailProvider(params)
  if (params.driver === EMAIL_DRIVER.RESEND) return createResendEmailProvider(params)
  if (params.driver === EMAIL_DRIVER.SES) return createSesEmailProvider(params)

  const _exhaustive: never = params
  throw new Error(`Driver de e-mail desconhecido: ${String((_exhaustive as { driver?: unknown }).driver)}`)
}
