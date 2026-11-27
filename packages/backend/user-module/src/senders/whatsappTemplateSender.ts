/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Canal `whatsapp-template`: manda o código num modelo de AUTENTICAÇÃO da Meta (corpo com o código e botão "copiar
 * código"). Ligado só quando o host passa este sender em `providers.verificationSenders`.
 *
 * O módulo não fala com a Meta: o host entrega `send`, que normalmente é uma chamada ao `sendTemplate` do
 * `@adatechnology/meta-whatsapp-module` (ou do `meta-whatsapp-provider`) com os `components` recebidos.
 */

import {
  PHONE_VERIFICATION_METHOD,
  type DeliveryAttemptResult,
  type VerificationCodeSenderPort,
} from '@adatechnology/user-contracts'

export type WhatsappTemplateComponent =
  | { readonly type: 'body'; readonly parameters: readonly { readonly type: 'text'; readonly text: string }[] }
  | {
      readonly type: 'button'
      readonly sub_type: 'url'
      readonly index: '0'
      readonly parameters: readonly { readonly type: 'text'; readonly text: string }[]
    }

export type WhatsappTemplateSend = (params: {
  readonly to: string
  readonly templateName: string
  readonly languageCode: string
  readonly components: readonly WhatsappTemplateComponent[]
}) => Promise<void>

export function buildAuthenticationTemplateComponents(code: string): WhatsappTemplateComponent[] {
  return [
    { type: 'body', parameters: [{ type: 'text', text: code }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
  ]
}

export function createWhatsappTemplateVerificationSender(params: {
  readonly templateName: string
  readonly send: WhatsappTemplateSend
  /** Idioma do modelo aprovado na Meta. Ausente = `pt_BR`. */
  readonly languageCode?: string
  readonly channel?: string
  /** Falha de envio → resultado. Ausente: `retriable` para erro de rede/5xx que o host marque, senão `permanent`. */
  readonly classifyError?: (error: unknown) => DeliveryAttemptResult
}): VerificationCodeSenderPort {
  return {
    channel: params.channel ?? PHONE_VERIFICATION_METHOD.WHATSAPP_TEMPLATE,
    async send(input) {
      try {
        await params.send({
          to: input.destination.replace(/\D/g, ''),
          templateName: params.templateName,
          languageCode: params.languageCode ?? 'pt_BR',
          components: buildAuthenticationTemplateComponents(input.code),
        })
        return { outcome: 'sent' }
      } catch (error) {
        return params.classifyError
          ? params.classifyError(error)
          : { outcome: 'permanent', errorCode: 'whatsapp_template_failed' }
      }
    },
  }
}
