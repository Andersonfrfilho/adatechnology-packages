/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { LoggerPort, LogMeta } from '@adatechnology/coupon-contracts'

/**
 * Gancho do host roda depois da escrita confirmada: erro nele é logado (só ids, nunca contato) e
 * não desfaz o que já foi gravado.
 */
export async function runHook(params: {
  readonly name: string
  readonly logger: LoggerPort | undefined
  readonly meta: LogMeta
  readonly run: () => void | Promise<void>
}): Promise<void> {
  try {
    await params.run()
  } catch (error) {
    params.logger?.error(`coupons: gancho ${params.name} falhou`, {
      ...params.meta,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}
