/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Forma mínima que o `Transporter` do `nodemailer` já satisfaz. Declarada por estrutura — não
 * importada do pacote — para os testes injetarem um dublê sem carregar o SDK real.
 */
/**
 * `Buffer` e array mutavel para casar com o `Attachment` do nodemailer: o `Transporter` real
 * precisa continuar satisfazendo esta interface por estrutura, sem cast e sem importar o SDK.
 */
export type SmtpAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type SmtpMailMessage = {
  readonly from: string
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
  /** O nodemailer monta o MIME sozinho — aqui basta entregar os bytes. */
  readonly attachments?: SmtpAttachment[]
}

export type SmtpSendResult = {
  readonly messageId: string
  readonly accepted: readonly unknown[]
  readonly rejected: readonly unknown[]
}

export type SmtpTransportClient = {
  sendMail(message: SmtpMailMessage): Promise<SmtpSendResult>
}

export type SmtpError = {
  /** Código de resposta SMTP (RFC 5321): 4xx é transitório, 5xx é permanente. */
  readonly responseCode?: number
  readonly message?: string
}

export function isSmtpError(error: unknown): error is SmtpError {
  return typeof error === 'object' && error !== null
}
