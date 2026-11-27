/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Interceptador do bot para a ativação do telefone. O host o chama ANTES do fluxo normal, a cada mensagem recebida:
 *
 *   const result = await interceptor.handle({ senderPhone, companyId, text, buttonId })
 *   if (result.outcome === 'handled') return  // o bot já respondeu
 *   // 'continue': siga o fluxo normal
 *
 * Três situações, todas pelo número de quem escreveu (essa é a prova):
 *  - o texto traz o código ("Confirmar meu número: 482913");
 *  - qualquer outro texto de um número com ativação pendente: o bot pergunta UMA vez "Vi que você está ativando sua
 *    conta ... Foi você?" com os botões Sim / Não fui eu;
 *  - a resposta aos botões (`buttonId`): Sim confirma; Não cancela o código e avisa o host.
 *
 * O envio é do host (`messenger`): texto simples e botões de resposta rápida. Os textos são do host e editáveis.
 */

import type { UserModule } from '../UserModule'

export const PENDING_VERIFICATION_BUTTON = { YES: 'pv:yes:', NO: 'pv:no:' } as const

export type PendingVerificationMessenger = {
  sendText(params: { readonly to: string; readonly text: string }): Promise<void>
  sendButtons(params: {
    readonly to: string
    readonly body: string
    readonly buttons: readonly { readonly id: string; readonly title: string }[]
  }): Promise<void>
}

export type PendingVerificationTexts = {
  /** Corpo da pergunta; `maskedName` e `maskedEmail` são tudo o que o bot revela. */
  readonly prompt: (variables: { readonly maskedName: string; readonly maskedEmail: string | undefined }) => string
  readonly yesTitle: string
  readonly noTitle: string
  readonly confirmed: string
  readonly declined: string
  readonly rejected: string
}

export const DEFAULT_PENDING_VERIFICATION_TEXTS: PendingVerificationTexts = {
  prompt: ({ maskedName, maskedEmail }) =>
    `Vi que você está ativando sua conta (${maskedName}${maskedEmail ? `, ${maskedEmail}` : ''}). Foi você?`,
  yesTitle: 'Sim, confirmar',
  noTitle: 'Não fui eu',
  confirmed: 'Pronto, seu número foi confirmado ✅',
  declined: 'Tudo bem, cancelamos a verificação. Nada foi alterado.',
  rejected: 'Não consegui confirmar. Peça um novo código na sua conta.',
}

export type PendingVerificationResult = { readonly outcome: 'handled' | 'continue'; readonly isConfirmed?: boolean }

export function createPendingVerificationInterceptor(params: {
  readonly useCases: Pick<
    UserModule['useCases'],
    | 'matchInboundPhoneVerification'
    | 'offerPendingVerification'
    | 'confirmPendingVerification'
    | 'declinePendingVerification'
  >
  readonly messenger: PendingVerificationMessenger
  readonly texts?: Partial<PendingVerificationTexts>
}) {
  const { useCases, messenger } = params
  const texts = { ...DEFAULT_PENDING_VERIFICATION_TEXTS, ...params.texts }

  return {
    async handle(message: {
      readonly senderPhone: string
      readonly companyId?: string
      readonly text?: string
      readonly buttonId?: string
    }): Promise<PendingVerificationResult> {
      const scope = { senderPhone: message.senderPhone, ...(message.companyId ? { companyId: message.companyId } : {}) }
      const to = message.senderPhone

      if (message.buttonId?.startsWith(PENDING_VERIFICATION_BUTTON.YES)) {
        const challengeId = message.buttonId.slice(PENDING_VERIFICATION_BUTTON.YES.length)
        const result = await useCases.confirmPendingVerification.execute({ ...scope, challengeId })
        await messenger.sendText({ to, text: result.outcome === 'verified' ? texts.confirmed : texts.rejected })
        return { outcome: 'handled', isConfirmed: result.outcome === 'verified' }
      }
      if (message.buttonId?.startsWith(PENDING_VERIFICATION_BUTTON.NO)) {
        const challengeId = message.buttonId.slice(PENDING_VERIFICATION_BUTTON.NO.length)
        const result = await useCases.declinePendingVerification.execute({ ...scope, challengeId })
        await messenger.sendText({ to, text: result.outcome === 'declined' ? texts.declined : texts.rejected })
        return { outcome: 'handled' }
      }
      if (!message.text) return { outcome: 'continue' }

      const matched = await useCases.matchInboundPhoneVerification.execute({ ...scope, text: message.text })
      if (matched.outcome !== 'ignored') {
        await messenger.sendText({ to, text: matched.outcome === 'verified' ? texts.confirmed : texts.rejected })
        return { outcome: 'handled', isConfirmed: matched.outcome === 'verified' }
      }

      const offer = await useCases.offerPendingVerification.execute(scope)
      if (!offer) return { outcome: 'continue' }
      await messenger.sendButtons({
        to,
        body: texts.prompt({ maskedName: offer.maskedName, maskedEmail: offer.maskedEmail }),
        buttons: [
          { id: `${PENDING_VERIFICATION_BUTTON.YES}${offer.challengeId}`, title: texts.yesTitle },
          { id: `${PENDING_VERIFICATION_BUTTON.NO}${offer.challengeId}`, title: texts.noTitle },
        ],
      })
      return { outcome: 'handled' }
    },
  }
}
