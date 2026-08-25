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

/** Mutavel para casar por estrutura com o `Attachment` do SDK do Resend, sem importa-lo. */
export type ResendAttachment = {
  filename: string
  /** Base64 do arquivo. O SDK aceita `Buffer` tambem, mas a string atravessa o JSON sem surpresa. */
  content: string
  contentType: string
}

export type ResendEmailsClient = {
  send(message: {
    readonly from: string
    readonly to: string
    readonly subject: string
    readonly html: string
    readonly text: string
    readonly replyTo?: string
    /**
     * O Resend recebe o arquivo no proprio JSON, em base64 — nao ha upload separado nem URL. Por
     * isso o driver baixa antes: o que ele envia e conteudo, nao referencia.
     */
    readonly attachments?: ResendAttachment[]
  }): Promise<ResendSendResult>
}

export type ResendClientLike = {
  readonly emails: ResendEmailsClient
}
