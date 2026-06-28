import { SEFAZ_RETRYABLE_CODES } from './SefazConstants'
import { FiscalError, FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'

type RetryConfig = {
  readonly maxAttempts: number
  readonly initialDelayMs: number
  readonly factor: number
  readonly maxDelayMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  factor: 2,
  maxDelayMs: 30_000,
}

type RetryLogger = {
  warn(message: string, meta?: Record<string, unknown>): void
}

type RetryOptions = {
  readonly config?: RetryConfig
  readonly logger?: RetryLogger
  readonly operationName?: string
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = options.config ?? DEFAULT_RETRY_CONFIG
  const logger = options.logger
  const operationName = options.operationName ?? 'operação'

  let lastError: unknown

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error

      if (!isRetryable(error)) throw error
      if (attempt === config.maxAttempts) throw error

      const delayMs = Math.min(
        config.initialDelayMs * Math.pow(config.factor, attempt - 1),
        config.maxDelayMs
      )

      logger?.warn(`${operationName} falhou na tentativa ${attempt}/${config.maxAttempts} — aguardando ${delayMs}ms`, {
        attempt,
        maxAttempts: config.maxAttempts,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      })

      await sleep(delayMs)
    }
  }

  throw lastError
}

function isRetryable(error: unknown): boolean {
  if (error instanceof FiscalTimeoutError) return true
  if (error instanceof FiscalConnectionError) return true

  if (error instanceof FiscalError && SEFAZ_RETRYABLE_CODES.has(error.code)) return true

  if (error instanceof Error) {
    const networkErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH']
    return networkErrors.some(code => error.message.includes(code))
  }

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
