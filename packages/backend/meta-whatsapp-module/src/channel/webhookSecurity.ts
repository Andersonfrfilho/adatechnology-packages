/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O algoritmo mora em `meta-graph-core`, compartilhado com os outros objetos que a Meta assina.
 * Aqui fica só a tradução para o vocabulário deste domínio: o erro lançado e o namespace do nonce.
 */

import {
  WEBHOOK_CLAIM_TTL_SECONDS,
  WEBHOOK_NONCE_TTL_SECONDS,
  buildWebhookDeliveryKey,
  isValidWebhookChallenge,
  isValidWebhookSignature,
} from '@adatechnology/meta-graph-core'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'

export interface NonceStoreInterface {
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
  /**
   * Estende a chave já reivindicada para a janela cheia. Um SET simples, sem NX.
   *
   * Opcional só por compatibilidade com hosts que ainda não o implementam: sem ele o claim curto
   * expira, e a Meta pode reentregar uma entrega já processada — trabalho repetido, que a dedupe
   * por `waMessageId` ainda segura antes de virar efeito visível ao cliente. Implementar é o
   * caminho correto.
   */
  confirm?(key: string, ttlSeconds: number): Promise<void>
}

export { WEBHOOK_CLAIM_TTL_SECONDS, WEBHOOK_NONCE_TTL_SECONDS }

const WEBHOOK_NONCE_NAMESPACE = 'meta-whatsapp'

export function verifyWebhookChallenge(params: {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedToken: string
}): string {
  if (!isValidWebhookChallenge(params)) throw new InvalidWebhookSignatureError()
  return params.challenge as string
}

export function verifyWebhookSignature(params: {
  rawBody: Buffer | string
  signatureHeader: string | null | undefined
  appSecret: string
}): void {
  if (!isValidWebhookSignature(params)) throw new InvalidWebhookSignatureError()
}

function deliveryKey(signatureHeader: string): string {
  return buildWebhookDeliveryKey({
    namespace: WEBHOOK_NONCE_NAMESPACE,
    signatureHeader,
  })
}

/**
 * Reivindica a entrega por pouco tempo. O par obrigatório é `confirmWebhookDelivery` ao fim do
 * processamento — ver `WEBHOOK_CLAIM_TTL_SECONDS` para o porquê dos dois tempos.
 */
export async function claimWebhookDelivery(params: {
  nonceStore: NonceStoreInterface
  signatureHeader: string
  ttlSeconds?: number
}): Promise<boolean> {
  return params.nonceStore.setIfAbsent(
    deliveryKey(params.signatureHeader),
    params.ttlSeconds ?? WEBHOOK_CLAIM_TTL_SECONDS,
  )
}

/** Só depois da entrega processada por inteiro: é isto que fecha a janela anti-replay. */
export async function confirmWebhookDelivery(params: {
  nonceStore: NonceStoreInterface
  signatureHeader: string
  ttlSeconds?: number
}): Promise<void> {
  await params.nonceStore.confirm?.(deliveryKey(params.signatureHeader), params.ttlSeconds ?? WEBHOOK_NONCE_TTL_SECONDS)
}
