/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O algoritmo mora em `meta-graph-core`, compartilhado com os outros objetos que a Meta assina.
 * Aqui fica só a tradução para o vocabulário deste domínio: o erro lançado e o namespace do nonce.
 */

import {
  WEBHOOK_NONCE_TTL_SECONDS,
  buildWebhookDeliveryKey,
  isValidWebhookChallenge,
  isValidWebhookSignature,
} from '@adatechnology/meta-graph-core'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'

export interface NonceStoreInterface {
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
}

export { WEBHOOK_NONCE_TTL_SECONDS }

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

export async function claimWebhookDelivery(params: {
  nonceStore: NonceStoreInterface
  signatureHeader: string
  ttlSeconds?: number
}): Promise<boolean> {
  const key = buildWebhookDeliveryKey({
    namespace: WEBHOOK_NONCE_NAMESPACE,
    signatureHeader: params.signatureHeader,
  })
  return params.nonceStore.setIfAbsent(key, params.ttlSeconds ?? WEBHOOK_NONCE_TTL_SECONDS)
}
