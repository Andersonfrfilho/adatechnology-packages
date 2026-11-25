/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Contato do simulador de conversa. Mesmo papel de `previewMedia.types.ts`: uma convenção com dois
 * lados (o simulador gera o número, o canal o reconhece), por isso mora no contrato.
 *
 * Número de WhatsApp real (`wa_id`) começa pelo código do país, e nenhum código de país começa com
 * zero — um número que começa com `0` nunca é de uma pessoa. É o que permite ao canal responder ao
 * simulador sem chamar a Meta, sem risco de engolir a mensagem de um cliente de verdade.
 */

export const PREVIEW_CONTACT_PREFIX = '0'

/** Número padrão do simulador quando o host não escolhe outro. */
export const DEFAULT_PREVIEW_CONTACT = `${PREVIEW_CONTACT_PREFIX}5500000000000`

/** Número do simulador a partir de dígitos quaisquer (ex.: um por operador, para conversas separadas). */
export function toPreviewContact(digits: string): string {
  const onlyDigits = digits.replace(/\D/g, '')
  return onlyDigits.startsWith(PREVIEW_CONTACT_PREFIX) ? onlyDigits : `${PREVIEW_CONTACT_PREFIX}${onlyDigits}`
}

export function isPreviewContact(whatsappNumber: string): boolean {
  return whatsappNumber.startsWith(PREVIEW_CONTACT_PREFIX)
}
