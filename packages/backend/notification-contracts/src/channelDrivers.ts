/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { DevicePlatform, PushDriver, SuppressionReason } from './notification.types'

/**
 * Resultado de UMA tentativa de entrega, classificado **pelo driver** — nunca pelo módulo.
 *
 * Só o driver sabe que `DeviceNotRegistered` (Expo) e `registration-token-not-registered` (FCM)
 * significam "apaga o token", e que 429/5xx significa "tenta de novo". Deixar essa leitura no
 * módulo o obrigaria a conhecer o vocabulário de erro de cada provedor — e foi assim que, no
 * modelo antigo, token morto ficava vivo para sempre e erro permanente entrava em retry infinito.
 *
 * O módulo age sobre o discriminante:
 * - `sent` grava `providerMessageId`;
 * - `invalid_target` desativa o device ou cria supressão, **sem** retry;
 * - `retriable` reagenda com backoff exponencial + jitter até esgotar `attempts`;
 * - `permanent` finaliza como `failed` na primeira tentativa.
 */
export type DeliveryAttemptResult =
  | { readonly outcome: 'sent'; readonly providerMessageId?: string }
  | { readonly outcome: 'invalid_target'; readonly errorCode: string; readonly suppressionReason?: SuppressionReason }
  | { readonly outcome: 'retriable'; readonly errorCode: string; readonly retryAfterSeconds?: number }
  | { readonly outcome: 'permanent'; readonly errorCode: string }

export type SendPushParams = {
  readonly token: string
  readonly platform: DevicePlatform
  readonly title: string
  readonly body: string
  /**
   * Só identificadores opacos (`notificationId`, `orderId`) — o payload viaja pelos servidores
   * da Apple, Google e Expo, então nada de PII aqui (`security.md` §1).
   */
  readonly data?: Readonly<Record<string, string>>
  readonly badge?: number
}

export type SendEmailParams = {
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
  /** Correlaciona o recibo assíncrono (bounce/complaint) com a `delivery` que o originou. */
  readonly idempotencyKey?: string
}

export type SendWhatsAppTemplateParams = {
  readonly templateName: string
  readonly languageCode: string
  readonly bodyParameters?: readonly string[]
}

export type SendWhatsAppParams = {
  readonly to: string
  readonly body: string
  /**
   * Presente = envio por template aprovado, único caminho válido fora da janela de 24 h.
   * Ausente = mensagem livre, que a Meta só aceita dentro da janela.
   */
  readonly template?: SendWhatsAppTemplateParams
}

export type SendSmsParams = {
  readonly to: string
  readonly body: string
}

export interface PushDriverPort {
  readonly driver: PushDriver
  send(params: SendPushParams): Promise<DeliveryAttemptResult>
}

export interface EmailDriverPort {
  readonly driver: string
  send(params: SendEmailParams): Promise<DeliveryAttemptResult>
}

/**
 * Satisfeita pelo `channel` do `meta-whatsapp-module` via `createWhatsAppDriverFromChannel()`.
 * O contracts descreve a *forma* e não importa nada da Meta: é o que mantém os dois trios
 * independentes, com a costura acontecendo no produto (regra de módulos plugáveis, §2).
 */
export interface WhatsAppDriverPort {
  send(params: SendWhatsAppParams): Promise<DeliveryAttemptResult>
}

/**
 * Declarada sem driver publicado, de propósito: não há consumidor de SMS no ecossistema hoje, e
 * extrair antes do 1º uso real é abstração prematura. Canal `sms` ligado sem driver injetado
 * falha **no boot**, não na primeira notificação.
 */
export interface SmsDriverPort {
  send(params: SendSmsParams): Promise<DeliveryAttemptResult>
}

export type ChannelDrivers = {
  readonly push?: PushDriverPort
  readonly email?: EmailDriverPort
  readonly whatsapp?: WhatsAppDriverPort
  readonly sms?: SmsDriverPort
}
