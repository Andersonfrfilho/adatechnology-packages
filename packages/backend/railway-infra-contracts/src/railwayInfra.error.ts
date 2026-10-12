/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida: pacote publicado não importa o `RailwayInfraError` do host. O shape
 * (`code`, `statusCode`, `context`) é o mesmo do `AppError` dos produtos, e o filtro de exceção do
 * host trata os dois igual — inclusive `context.retryAfterSeconds` virando `Retry-After`.
 */

export type RailwayInfraErrorParams = {
  readonly code: string
  readonly message: string
  readonly statusCode: number
  readonly context?: Readonly<Record<string, unknown>>
}

export class RailwayInfraError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly context: Readonly<Record<string, unknown>>

  constructor({ code, message, statusCode, context }: RailwayInfraErrorParams) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.statusCode = statusCode
    this.context = context ?? {}
    Error.captureStackTrace?.(this, new.target)
  }
}

export function isRailwayInfraError(value: unknown): value is RailwayInfraError {
  return value instanceof RailwayInfraError
}
