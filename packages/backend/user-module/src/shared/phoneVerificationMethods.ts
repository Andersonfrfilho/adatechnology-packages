/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quais métodos de verificação existem agora e qual vale para uma escolha. Método escolhido que não está
 * configurado cai no padrão (`whatsapp-inbound`, depois o primeiro canal de envio): a tela nunca fica sem caminho.
 */

import {
  PHONE_VERIFICATION_METHOD,
  type PhoneVerificationConfig,
  type VerificationCodeSenderPort,
} from '@adatechnology/user-contracts'

export type PhoneVerificationMethodOption = {
  readonly id: string
  /** `false` = não há provedor/credencial para ele; `reason` diz o que falta (para a tela desabilitar a opção). */
  readonly isAvailable: boolean
  readonly reason?: string
}

const KNOWN_METHODS: readonly string[] = Object.values(PHONE_VERIFICATION_METHOD)

export function listPhoneVerificationMethods(params: {
  readonly config: PhoneVerificationConfig | undefined
  readonly senders: readonly VerificationCodeSenderPort[]
}): PhoneVerificationMethodOption[] {
  const { config, senders } = params
  const channels = new Set(senders.map((sender) => sender.channel))
  const ids = [...new Set([...KNOWN_METHODS, ...channels])]
  return ids.map((id) => {
    if (id === PHONE_VERIFICATION_METHOD.WHATSAPP_INBOUND) {
      return config?.inbound
        ? { id, isAvailable: true }
        : { id, isAvailable: false, reason: 'Recebimento de mensagens não configurado' }
    }
    return channels.has(id)
      ? { id, isAvailable: true }
      : { id, isAvailable: false, reason: 'Provedor de envio não configurado' }
  })
}

export function resolvePhoneVerificationMethod(params: {
  readonly selected?: string | undefined
  readonly config: PhoneVerificationConfig | undefined
  readonly senders: readonly VerificationCodeSenderPort[]
}): { readonly method: string | undefined; readonly isFallback: boolean } {
  const available = listPhoneVerificationMethods(params)
    .filter((option) => option.isAvailable)
    .map((option) => option.id)
  if (params.selected && available.includes(params.selected)) return { method: params.selected, isFallback: false }
  const standard = available.includes(PHONE_VERIFICATION_METHOD.WHATSAPP_INBOUND)
    ? PHONE_VERIFICATION_METHOD.WHATSAPP_INBOUND
    : available[0]
  return { method: standard, isFallback: params.selected !== undefined && params.selected !== standard }
}
