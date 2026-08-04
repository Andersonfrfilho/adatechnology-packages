/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Verificação genérica de assinatura para `/notification-webhooks/:driver` — mesmo esquema do
 * `X-Hub-Signature-256` da Meta (`meta-whatsapp-module/channel/webhookSecurity.ts`): HMAC-SHA256
 * sobre o `rawBody`, com um segredo que o host compartilha com quem envia o recibo.
 *
 * **Gap documentado:** isto NÃO verifica a assinatura nativa de cada provedor (Svix da Resend,
 * certificado X.509 da SNS/SES). Um host que quer aceitar o webhook nativo do provedor precisa de
 * uma camada de tradução própria na frente desta rota. O que este arquivo garante é que, com o
 * segredo configurado, ninguém além de quem o conhece consegue forjar uma entrega.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { InvalidWebhookSignatureError } from '@adatechnology/notification-contracts'
import type { CachePort } from '@adatechnology/notification-contracts'

export const WEBHOOK_TIMESTAMP_WINDOW_SECONDS = 300
export const WEBHOOK_NONCE_TTL_SECONDS = 300

function safeEqualStrings(left: string, right: string): boolean {
  // Nunca compara os dois valores diretamente — tamanhos diferentes ou hex inválido em
  // `timingSafeEqual` lançam, então HMAC-se os dois antes para chegar sempre em digests de
  // tamanho fixo (mesmo truque de `meta-whatsapp-module`).
  const leftDigest = createHmac('sha256', 'constant-time-compare').update(left).digest()
  const rightDigest = createHmac('sha256', 'constant-time-compare').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

export function verifyNotificationWebhookSignature(params: {
  readonly rawBody: Buffer | string
  readonly signatureHeader: string | null | undefined
  readonly timestampHeader: string | null | undefined
  readonly secret: string
  readonly now?: Date
}): void {
  if (!params.signatureHeader?.startsWith('sha256=')) throw new InvalidWebhookSignatureError()
  if (!params.timestampHeader) throw new InvalidWebhookSignatureError()

  const timestampSeconds = Number(params.timestampHeader)
  if (!Number.isFinite(timestampSeconds)) throw new InvalidWebhookSignatureError()

  const nowSeconds = (params.now?.getTime() ?? Date.now()) / 1000
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TIMESTAMP_WINDOW_SECONDS) {
    throw new InvalidWebhookSignatureError()
  }

  const expected = createHmac('sha256', params.secret)
    .update(params.timestampHeader)
    .update(params.rawBody)
    .digest('hex')
  const received = params.signatureHeader.slice('sha256='.length)
  if (!safeEqualStrings(received, expected)) throw new InvalidWebhookSignatureError()
}

/**
 * Reivindica a entrega por nonce, atômico via `CachePort.increment` (equivalente a `INCR` do
 * Redis): a primeira chamada leva o contador a 1 e reivindica; qualquer repetição encontra o
 * contador já maior que 1 e é rejeitada como replay — sem janela de corrida entre "ler" e
 * "escrever" que duas requisições concorrentes pudessem atravessar juntas.
 */
export async function claimNotificationWebhookDelivery(params: {
  readonly cache: CachePort
  readonly driver: string
  readonly nonce: string
  readonly ttlSeconds?: number
}): Promise<boolean> {
  const key = `notification:webhook:${params.driver}:${params.nonce}`
  const count = await params.cache.increment({ key, ttlSeconds: params.ttlSeconds ?? WEBHOOK_NONCE_TTL_SECONDS })
  return count === 1
}
