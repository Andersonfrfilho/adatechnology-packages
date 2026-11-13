/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * `statusCode` com esse nome de propósito: a ponte `createWhatsAppDriverFromChannel` do
 * notification-contracts classifica por `statusCode` (429/5xx tenta de novo, 4xx desiste).
 */
export class EvolutionError extends Error {
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'EvolutionError'
    this.statusCode = statusCode
  }
}

/** Recurso que o Evolution não tem (modelo aprovado, reuso de mediaId): definitivo, não adianta repetir. */
export class EvolutionUnsupportedError extends EvolutionError {
  constructor(feature: string) {
    super(`evolution does not support ${feature}`, 400)
    this.name = 'EvolutionUnsupportedError'
  }
}
