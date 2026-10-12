/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RAILWAY_GRAPHQL_URL } from '@adatechnology/infra-contracts'
import {
  InfraProviderRateLimitedError,
  InfraProviderRejectedError,
  InfraProviderRequestFailedError,
} from '@adatechnology/infra-contracts'
import { RailwayRateLimitGate } from './RailwayRateLimitGate'
import { railwayEnvelopeSchema } from './railwayGateway.schema'
import type { ExecuteRailwayParams } from '@adatechnology/infra-contracts'

const REQUEST_TIMEOUT_MILLISECONDS = 20_000
const HTTP_TOO_MANY_REQUESTS = 429
const AUTH_FAILURE_STATUSES: readonly number[] = [401, 403]
const AUTH_FAILURE_MESSAGE_PATTERN = /not authorized|unauthorized|unauthenticated/i
const NOT_FOUND_MESSAGE_PATTERN = /not found/i

export type RailwayGraphqlClientDependencies = {
  readonly token: string
  readonly fetchImplementation: typeof fetch
  readonly now: () => number
}

/**
 * Transporte da API GraphQL do Railway. Toda resposta e entrada nao confiavel: passa por zod, e `errors`
 * conta como falha mesmo com HTTP 200. O token so vai no header; nunca entra em mensagem, contexto de erro ou log.
 */
export class RailwayGraphqlClient {
  // Campo `#`: nao aparece em Object.keys, JSON.stringify nem inspect, entao console.log do cliente nao vaza o token.
  readonly #token: string
  private readonly fetchImplementation: typeof fetch
  private readonly rateLimitGate: RailwayRateLimitGate

  constructor({ token, fetchImplementation, now }: RailwayGraphqlClientDependencies) {
    this.#token = token
    this.fetchImplementation = fetchImplementation
    this.rateLimitGate = new RailwayRateLimitGate(now)
  }

  async execute<TData>(params: ExecuteRailwayParams<TData>): Promise<TData> {
    const { operationName, query, variables, schema } = params
    this.rateLimitGate.assertNotBlocked()

    try {
      const response = await this.fetchImplementation(RAILWAY_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.#token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      })

      if (response.status === HTTP_TOO_MANY_REQUESTS) throw this.rateLimitGate.blockAfterRateLimit(response.headers)
      if (AUTH_FAILURE_STATUSES.includes(response.status)) {
        throw new InfraProviderRejectedError({ operation: operationName, isAuthFailure: true })
      }
      if (!response.ok) throw new InfraProviderRequestFailedError(operationName)

      const envelope = railwayEnvelopeSchema.safeParse(await response.json())
      if (!envelope.success) throw new InfraProviderRequestFailedError(operationName)
      if (envelope.data.errors && envelope.data.errors.length > 0) {
        throw new InfraProviderRejectedError({
          operation: operationName,
          isAuthFailure: envelope.data.errors.some(isAuthErrorEntry),
          isNotFound: envelope.data.errors.some(isNotFoundErrorEntry),
        })
      }

      const parsed = schema.safeParse(envelope.data.data)
      if (!parsed.success) throw new InfraProviderRequestFailedError(operationName)

      return parsed.data
    } catch (error) {
      if (error instanceof InfraProviderRateLimitedError || error instanceof InfraProviderRequestFailedError)
        throw error

      throw new InfraProviderRequestFailedError(operationName)
    }
  }
}

function isAuthErrorEntry(entry: unknown): boolean {
  return matchesErrorMessage(entry, AUTH_FAILURE_MESSAGE_PATTERN)
}

function isNotFoundErrorEntry(entry: unknown): boolean {
  return matchesErrorMessage(entry, NOT_FOUND_MESSAGE_PATTERN)
}

function matchesErrorMessage(entry: unknown, pattern: RegExp): boolean {
  if (typeof entry !== 'object' || entry === null || !('message' in entry)) return false
  return typeof entry.message === 'string' && pattern.test(entry.message)
}
