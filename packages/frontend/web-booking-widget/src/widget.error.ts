/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type WidgetRequestErrorParams = {
  readonly status: number
  readonly code: string
  readonly retryAfterSeconds: number
}

/**
 * Falha de requisição que preserva o motivo, e não só o fato.
 *
 * O `code` é a chave estável do contrato (`{ error: { code, message } }`); o `status` cobre a rede
 * quando nem isso chega — resposta de proxy ou corpo ilegível.
 */
export class WidgetRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterSeconds: number

  constructor({ status, code, retryAfterSeconds }: WidgetRequestErrorParams) {
    super(`booking widget request failed: ${status} ${code}`.trim())
    this.name = 'WidgetRequestError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function toRetryAfterSeconds(header: string | null): number {
  const seconds = Number(header)

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0
}

/** O corpo de erro é entrada não confiável como qualquer outra: ilegível vira código vazio. */
export function getApiErrorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('error' in body)) return ''

  const { error } = body as { error: unknown }
  if (typeof error !== 'object' || error === null || !('code' in error)) return ''

  const { code } = error as { code: unknown }

  return typeof code === 'string' ? code : ''
}
