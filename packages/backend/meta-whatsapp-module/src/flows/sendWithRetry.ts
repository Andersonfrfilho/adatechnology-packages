/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Retentativa de UM envio de saída do robô, com limite e backoff exponencial.
 *
 * Cada mensagem do turno é retentada sozinha: se a segunda falha, a primeira (já entregue) não sai de
 * novo. Só se repete falha em que a Meta nunca recebeu a mensagem; o resto (recusa da Meta, erro de
 * banco depois do envio, janela expirada) sobe na primeira vez — repetir duplicaria ou falharia igual.
 */

import { WhatsAppConnectionError } from '@adatechnology/meta-graph-core'
import type { FlowSendRetryConfig } from './flowRunner.types'
import {
  DEFAULT_SEND_RETRY_BASE_DELAY_MS,
  DEFAULT_SEND_RETRY_MAX_ATTEMPTS,
  DEFAULT_SEND_RETRY_MAX_DELAY_MS,
} from './flowRunner.constant'

/**
 * Padrão de `FlowSendRetryConfig.shouldRetry`: falha de rede antes de a requisição ser entregue.
 * Timeout fica de fora de propósito: a Meta pode ter aceitado a mensagem e a Cloud API não tem chave
 * de idempotência, então repetir arriscaria mandar duas vezes. O host que prefere repetir passa o
 * próprio `shouldRetry`.
 */
export function isTransientSendError(error: unknown): boolean {
  return error instanceof WhatsAppConnectionError
}

const sleepFor = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds))

export type SendWithRetryResult = {
  /** Tentativas feitas (1 = sem retentativa). */
  readonly attempts: number
}

/** Falha de envio já sem retentativa a fazer: o erro original e o que se tentou. */
export class SendRetriesExhausted {
  constructor(
    readonly error: unknown,
    readonly attempts: number,
    readonly isTransient: boolean,
  ) {}
}

export async function sendWithRetry(
  send: () => Promise<void>,
  config: FlowSendRetryConfig = {},
): Promise<SendWithRetryResult> {
  const maxAttempts = Math.max(1, config.maxAttempts ?? DEFAULT_SEND_RETRY_MAX_ATTEMPTS)
  const baseDelay = config.baseDelayMs ?? DEFAULT_SEND_RETRY_BASE_DELAY_MS
  const maxDelay = config.maxDelayMs ?? DEFAULT_SEND_RETRY_MAX_DELAY_MS
  const shouldRetry = config.shouldRetry ?? isTransientSendError
  const sleep = config.sleep ?? sleepFor

  for (let attempt = 1; ; attempt++) {
    try {
      await send()
      return { attempts: attempt }
    } catch (error) {
      const isTransient = shouldRetry(error)
      if (!isTransient || attempt >= maxAttempts) throw new SendRetriesExhausted(error, attempt, isTransient)
      await sleep(Math.min(baseDelay * 2 ** (attempt - 1), maxDelay))
    }
  }
}
