/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Primitivos de verificação de webhook da Meta, compartilhados por todo objeto que ela assina
 * (WhatsApp Business Account, catálogo, business). O app secret é um só e o algoritmo também:
 * duplicar isso por módulo faria uma correção de segurança precisar ser lembrada em N lugares.
 *
 * Devolvem `boolean` de propósito. Quem lança é o módulo, com o erro do próprio domínio — este
 * pacote não pode depender dos contracts de cada módulo, e o host mapeia status HTTP por
 * hierarquia de erro.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const WEBHOOK_NONCE_TTL_SECONDS = 300

/**
 * Compara por digest de tamanho fixo: `timingSafeEqual` lança quando os buffers têm tamanhos
 * diferentes, e aí o próprio tamanho do segredo vazaria pela exceção.
 */
function safeEqualStrings(left: string, right: string): boolean {
  const leftDigest = createHmac('sha256', 'constant-time-compare').update(left).digest()
  const rightDigest = createHmac('sha256', 'constant-time-compare').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

export type WebhookChallengeParams = {
  readonly mode: string | null
  readonly token: string | null
  readonly challenge: string | null
  readonly expectedToken: string
}

/** `true` = é o handshake de assinatura da Meta e o token confere; o chamador devolve o challenge. */
export function isValidWebhookChallenge(params: WebhookChallengeParams): boolean {
  if (params.mode !== 'subscribe' || !params.token || !params.challenge) return false
  return safeEqualStrings(params.token, params.expectedToken)
}

export type WebhookSignatureParams = {
  /**
   * Bytes crus, como chegaram. Reserializar o JSON muda espaçamento e ordem de chave, e o HMAC
   * deixa de bater — é o erro clássico deste caminho.
   */
  readonly rawBody: Buffer | string | Uint8Array
  readonly signatureHeader: string | null | undefined
  readonly appSecret: string
}

export function isValidWebhookSignature(params: WebhookSignatureParams): boolean {
  const { rawBody, signatureHeader, appSecret } = params
  if (!signatureHeader?.startsWith('sha256=')) return false

  const payload = Buffer.isBuffer(rawBody) || typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody)
  const expected = createHmac('sha256', appSecret).update(payload).digest('hex')

  return safeEqualStrings(signatureHeader.slice('sha256='.length), expected)
}

/**
 * Chave de idempotência de entrega. A Meta reentrega o mesmo payload em retry, e a assinatura é
 * estável para um mesmo corpo — serve de nonce sem inventar hash.
 *
 * O `namespace` separa os objetos: dois webhooks distintos com corpos iguais teriam a mesma
 * assinatura, e um cancelaria o outro se dividissem a chave.
 */
export function buildWebhookDeliveryKey(params: { namespace: string; signatureHeader: string }): string {
  return `${params.namespace}:webhook:${params.signatureHeader}`
}
