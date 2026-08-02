/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { PUSH_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, PushDriverPort, SendPushParams } from '@adatechnology/notification-contracts'

import type { ExpoPushMessage, ExpoPushResponse, ExpoPushTicket } from './expoTypes'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Limite documentado da API — enviar mais que isso na mesma chamada é rejeitado pela Expo.
const EXPO_PUSH_CHUNK_SIZE = 100

export type ExpoPushProviderConfig = {
  /** Access token de organização Expo (EAS) — opcional para apps standalone sem EAS. */
  readonly accessToken?: string
  /** Injeção para teste; produção usa o `fetch` global. */
  readonly fetchImpl?: typeof fetch
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size) as T[])
  }
  return chunks
}

// Ticket de erro documentado pela Expo — "apaga o token" é sempre DeviceNotRegistered.
function classifyExpoTicket(ticket: ExpoPushTicket): DeliveryAttemptResult {
  if (ticket.status === 'ok') return { outcome: 'sent', providerMessageId: ticket.id }

  const errorCode = ticket.details?.error ?? 'unknown'
  if (errorCode === 'DeviceNotRegistered') return { outcome: 'invalid_target', errorCode }
  if (errorCode === 'MessageRateExceeded') return { outcome: 'retriable', errorCode }
  // MessageTooBig, InvalidCredentials e qualquer código novo: tratar como definitivo é mais seguro
  // que retry silencioso — o host vê o erro no primeiro delivery em vez de gastar 5 tentativas.
  return { outcome: 'permanent', errorCode }
}

function classifyHttpStatus(status: number): DeliveryAttemptResult {
  if (status === 429 || status >= 500) return { outcome: 'retriable', errorCode: `http_${status}` }
  return { outcome: 'permanent', errorCode: `http_${status}` }
}

async function sendExpoPushChunk(
  messages: readonly ExpoPushMessage[],
  config: ExpoPushProviderConfig,
): Promise<DeliveryAttemptResult[]> {
  const fetchImpl = config.fetchImpl ?? fetch
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (config.accessToken) headers.Authorization = `Bearer ${config.accessToken}`

  const response = await fetchImpl(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  })

  if (!response.ok) {
    const outcome = classifyHttpStatus(response.status)
    return messages.map(() => outcome)
  }

  const payload = (await response.json()) as ExpoPushResponse
  return payload.data.map(classifyExpoTicket)
}

/**
 * Envio em lote — usado internamente por `send()` (lote de 1) e exportado para o `notification-module`
 * poder despachar várias entregas na mesma janela de dispatch sem uma chamada HTTP por token.
 */
export async function sendExpoPushBatch(
  messages: readonly ExpoPushMessage[],
  config: ExpoPushProviderConfig = {},
): Promise<DeliveryAttemptResult[]> {
  const chunks = chunkArray(messages, EXPO_PUSH_CHUNK_SIZE)
  const chunkResults = await Promise.all(chunks.map((chunk) => sendExpoPushChunk(chunk, config)))
  return chunkResults.flat()
}

export function createExpoPushProvider(config: ExpoPushProviderConfig = {}): PushDriverPort {
  return {
    driver: PUSH_DRIVER.EXPO,
    async send(params: SendPushParams): Promise<DeliveryAttemptResult> {
      const message: ExpoPushMessage = {
        to: params.token,
        title: params.title,
        body: params.body,
        data: params.data,
        badge: params.badge,
      }

      const [result] = await sendExpoPushBatch([message], config)
      return result
    },
  }
}
