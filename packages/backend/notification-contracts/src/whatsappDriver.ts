/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { DeliveryAttemptResult, SendWhatsAppParams, WhatsAppDriverPort } from './channelDrivers'
import { SUPPRESSION_REASON } from './notification.types'

/**
 * Forma mínima que o `channel` do `meta-whatsapp-module` já satisfaz. Descrita aqui por
 * *estrutura*, e não importada do pacote de WhatsApp: é isso que mantém os dois trios
 * independentes — quem só usa inbox não carrega Meta, quem só usa WhatsApp não carrega
 * notificação, e a costura acontece no produto (regra de módulos plugáveis, §2).
 */
export type WhatsAppSendingChannel = {
  sendText(to: string, body: string): Promise<{ externalMessageId: string | null }>
  sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string | null }>
}

/**
 * Códigos da Graph API que o canal repassa. A lista é curta de propósito: cobre o que muda a
 * decisão do módulo (apagar destino × tentar de novo × desistir) e nada além disso.
 */
const INVALID_TARGET_CODES = new Set([131026, 131051])
const PERMANENT_CODES = new Set([131047, 131031, 368])
const RETRIABLE_CODES = new Set([613, 130429, 131056])

function readNumericField(error: unknown, field: string): number | undefined {
  if (typeof error !== 'object' || error === null || !(field in error)) return undefined
  const value = (error as Record<string, unknown>)[field]
  return typeof value === 'number' ? value : undefined
}

function classifyError(error: unknown): DeliveryAttemptResult {
  const metaCode = readNumericField(error, 'code')
  if (metaCode !== undefined) {
    if (INVALID_TARGET_CODES.has(metaCode)) {
      return {
        outcome: 'invalid_target',
        errorCode: `meta_${metaCode}`,
        suppressionReason: SUPPRESSION_REASON.BOUNCE,
      }
    }
    if (PERMANENT_CODES.has(metaCode)) return { outcome: 'permanent', errorCode: `meta_${metaCode}` }
    if (RETRIABLE_CODES.has(metaCode)) return { outcome: 'retriable', errorCode: `meta_${metaCode}` }
  }

  const statusCode = readNumericField(error, 'statusCode') ?? readNumericField(error, 'status')
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
    return { outcome: 'retriable', errorCode: `http_${statusCode}` }
  }
  if (statusCode !== undefined && statusCode >= 400) {
    return { outcome: 'permanent', errorCode: `http_${statusCode}` }
  }

  // Sem código nenhum é quase sempre falha de rede/DNS, que passa numa segunda tentativa. O risco
  // do palpite é limitado: o retry é finito (`attempts`) e termina em `failed` de qualquer forma.
  return { outcome: 'retriable', errorCode: 'unknown' }
}

export function createWhatsAppDriverFromChannel(channel: WhatsAppSendingChannel): WhatsAppDriverPort {
  return {
    async send(params: SendWhatsAppParams): Promise<DeliveryAttemptResult> {
      try {
        const result = params.template
          ? await channel.sendTemplate({
              to: params.to,
              templateName: params.template.templateName,
              languageCode: params.template.languageCode,
              bodyParameters: params.template.bodyParameters ? [...params.template.bodyParameters] : undefined,
            })
          : await channel.sendText(params.to, params.body)

        return { outcome: 'sent', providerMessageId: result.externalMessageId ?? undefined }
      } catch (error) {
        return classifyError(error)
      }
    },
  }
}
