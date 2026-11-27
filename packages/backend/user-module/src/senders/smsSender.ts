/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Canal `sms`: o código por mensagem de texto através de um gateway pequeno (`SmsGatewayPort`). Vem um adaptador
 * concreto, o do Twilio (uma chamada HTTP); outro fornecedor (Zenvia, Infobip, Vonage) é um adaptador de ~30 linhas
 * com a mesma porta.
 */

import {
  PHONE_VERIFICATION_METHOD,
  type DeliveryAttemptResult,
  type VerificationCodeSenderPort,
} from '@adatechnology/user-contracts'

export type SmsGatewayPort = {
  sendSms(params: { readonly to: string; readonly body: string }): Promise<DeliveryAttemptResult>
}

const DEFAULT_SMS_TEXT = (code: string, expiresInSeconds: number): string =>
  `Seu código de verificação é ${code}. Vale por ${Math.max(1, Math.round(expiresInSeconds / 60))} minutos.`

export function createSmsVerificationSender(params: {
  readonly gateway: SmsGatewayPort
  readonly buildMessage?: (variables: { readonly code: string; readonly expiresInSeconds: number }) => string
  readonly channel?: string
}): VerificationCodeSenderPort {
  return {
    channel: params.channel ?? PHONE_VERIFICATION_METHOD.SMS,
    send: (input) =>
      params.gateway.sendSms({
        to: input.destination,
        body: (params.buildMessage ?? ((variables) => DEFAULT_SMS_TEXT(variables.code, variables.expiresInSeconds)))({
          code: input.code,
          expiresInSeconds: input.expiresInSeconds,
        }),
      }),
  }
}

const TWILIO_INVALID_NUMBER_CODES: ReadonlySet<number> = new Set([21211, 21214, 21614])
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR = 500

/** Twilio Programmable Messaging (`POST /Messages.json`, autenticação básica). `fetchFn` existe para teste. */
export function createTwilioSmsGateway(params: {
  readonly accountSid: string
  readonly authToken: string
  readonly from: string
  readonly fetchFn?: typeof fetch
}): SmsGatewayPort {
  const fetchFn = params.fetchFn ?? fetch
  return {
    async sendSms(input) {
      let response: Response
      try {
        response = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: `+${input.to.replace(/\D/g, '')}`, From: params.from, Body: input.body }),
        })
      } catch {
        return { outcome: 'retriable', errorCode: 'network' }
      }
      const payload = (await response.json().catch(() => ({}))) as { sid?: string; code?: number }
      if (response.ok) return { outcome: 'sent', ...(payload.sid ? { providerMessageId: payload.sid } : {}) }
      if (payload.code !== undefined && TWILIO_INVALID_NUMBER_CODES.has(payload.code))
        return { outcome: 'invalid_target', errorCode: String(payload.code) }
      if (response.status === HTTP_TOO_MANY_REQUESTS || response.status >= HTTP_SERVER_ERROR)
        return { outcome: 'retriable', errorCode: String(response.status) }
      return { outcome: 'permanent', errorCode: String(payload.code ?? response.status) }
    },
  }
}
