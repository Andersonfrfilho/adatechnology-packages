/**
 * Assinatura de payload de preview no runtime do servidor. Os builders vivem em
 * `@adatechnology/meta-whatsapp-contracts/testing` porque precisam rodar também no navegador;
 * aqui fica só o que depende de `node:crypto`.
 *
 * Não existe bypass de assinatura em lugar nenhum: o preview bate na mesma rota, com a mesma
 * validação de HMAC de staging e produção. O que muda é apenas quem assina — a Meta lá, o app
 * secret local aqui.
 */

import { createHmac } from 'node:crypto'
import type { WhatsAppWebhookPayload } from '@adatechnology/meta-whatsapp-contracts'
import { serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'

export type SignWebhookPayloadParams = {
  readonly rawBody: string
  readonly appSecret: string
}

export function signWebhookPayload(params: SignWebhookPayloadParams): string {
  return `sha256=${createHmac('sha256', params.appSecret).update(params.rawBody).digest('hex')}`
}

export type SignedWebhookRequest = {
  readonly rawBody: string
  readonly headers: Readonly<Record<string, string>>
}

export type ToSignedWebhookRequestParams = {
  readonly payload: WhatsAppWebhookPayload
  readonly appSecret: string
}

/**
 * Devolve o corpo JÁ serializado junto da assinatura, porque a validação assina os bytes exatos:
 * quem serializar de novo antes de enviar (ou deixar o cliente HTTP serializar o objeto) muda
 * espaçamento/ordem e derruba a assinatura. Enviar `rawBody` como está é o contrato.
 */
export function toSignedWebhookRequest(params: ToSignedWebhookRequestParams): SignedWebhookRequest {
  const rawBody = serializeWebhookPayload(params.payload)

  return {
    rawBody,
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signWebhookPayload({ rawBody, appSecret: params.appSecret }),
    },
  }
}
