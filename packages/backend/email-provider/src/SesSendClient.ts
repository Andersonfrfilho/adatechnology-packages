/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Forma própria, não a do `@aws-sdk/client-sesv2` — os testes injetam este dublê sem carregar o
 * SDK real, e a versão exata do SDK do consumidor não vaza para a superfície pública do pacote.
 */
export type SesSendParams = {
  readonly from: string
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
}

export type SesSendResult = {
  readonly messageId?: string
}

export type SesSendClient = {
  sendEmail(params: SesSendParams): Promise<SesSendResult>
}

export type SesError = {
  readonly name: string
}

export function isSesError(error: unknown): error is SesError {
  return typeof error === 'object' && error !== null && 'name' in error && typeof (error as SesError).name === 'string'
}
