/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createSmtpEmailProvider } from './SmtpEmailProvider'
export type { SmtpEmailProviderConfig } from './SmtpEmailProvider'
export type { SmtpMailMessage, SmtpSendResult, SmtpTransportClient, SmtpError } from './SmtpTransportClient'

export { createResendEmailProvider } from './ResendEmailProvider'
export type { ResendEmailProviderConfig } from './ResendEmailProvider'
export type { ResendClientLike, ResendEmailsClient, ResendSendResult } from './ResendClient'

export { createSesEmailProvider } from './SesEmailProvider'
export type { SesEmailProviderConfig } from './SesEmailProvider'
export type { SesSendClient, SesSendParams, SesSendResult, SesError } from './SesSendClient'

export { createEmailProvider } from './EmailProviderFactory'
export type { CreateEmailProviderParams } from './EmailProviderFactory'

export { parseResendWebhook } from './receipts/parseResendWebhook'
export { parseSesNotification } from './receipts/parseSesNotification'
