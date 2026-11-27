/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Canal de verificação de mentira para teste e desenvolvimento local: guarda o que "enviaria".
 * Não envia nada para fora. Para entregar de verdade, escreva um `VerificationCodeSenderPort`
 * (ver o README: WhatsApp com modelo de autenticação, SMS).
 */

import type { DeliveryAttemptResult, VerificationCodeSenderPort } from '@adatechnology/user-contracts'

export type CapturedVerification = {
  readonly code: string
  readonly destination: string
  readonly channel: string
  readonly userId: string
}

export function createInMemoryVerificationSender(
  params: { readonly channel?: string; readonly outcome?: DeliveryAttemptResult } = {},
): VerificationCodeSenderPort & { readonly sent: CapturedVerification[] } {
  const sent: CapturedVerification[] = []
  const channel = params.channel ?? 'memory'
  return {
    channel,
    sent,
    async send(input) {
      const outcome = params.outcome ?? ({ outcome: 'sent' } as const)
      if (outcome.outcome === 'sent') {
        sent.push({ code: input.code, destination: input.destination, channel: input.channel, userId: input.userId })
      }
      return outcome
    },
  }
}
