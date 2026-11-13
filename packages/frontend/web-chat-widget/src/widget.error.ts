/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

export type WidgetRequestErrorParams = {
  readonly status: number
  readonly code: string
  readonly retryAfterSeconds: number
}

/**
 * Falha de requisicao que preserva o motivo, e nao so o fato.
 *
 * O `code` e a chave estavel do contrato (`{ error: { code, message } }`) e e por ele que a tela
 * escolhe a frase. O `status` fica como rede: resposta de proxy ou corpo ilegivel chegam sem codigo,
 * e ainda assim "espere um pouco" precisa sair diferente de "nao entendi seu audio". O
 * `retryAfterSeconds` vem do header, entao serve tanto a cota do provedor quanto ao limite da rota.
 */
export class WidgetRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterSeconds: number

  constructor({ status, code, retryAfterSeconds }: WidgetRequestErrorParams) {
    super(`widget request failed: ${status} ${code}`.trim())
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

/** O corpo de erro e entrada nao confiavel como qualquer outra: ilegivel vira codigo vazio. */
export function getApiErrorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('error' in body)) return ''

  const { error } = body as { error: unknown }
  if (typeof error !== 'object' || error === null || !('code' in error)) return ''

  const { code } = error as { code: unknown }

  return typeof code === 'string' ? code : ''
}
