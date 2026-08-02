/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Forma mínima que `new Resend(apiKey).emails` já satisfaz. O SDK do Resend não lança em erro de
 * negócio — devolve `{ data, error }` — então a classificação lê `error.name`, nunca uma exceção.
 */
export type ResendSendResult = {
  readonly data: { readonly id: string } | null
  readonly error: { readonly name: string; readonly message: string; readonly statusCode: number | null } | null
}

export type ResendEmailsClient = {
  send(message: {
    readonly from: string
    readonly to: string
    readonly subject: string
    readonly html: string
    readonly text: string
    readonly replyTo?: string
  }): Promise<ResendSendResult>
}

export type ResendClientLike = {
  readonly emails: ResendEmailsClient
}
