/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O número que escreveu ao bot tem uma verificação de telefone pendente: devolve o que o bot pode dizer ("foi você?")
 * — nome e e-mail mascarados — e marca que perguntou. No máximo UMA vez por código: depois disso devolve `undefined`
 * e a conversa segue o fluxo normal.
 */

import { loadPendingVerification } from '../shared/loadPendingVerification'
import { maskEmail, maskName } from '../shared/maskIdentity'
import { nowOf, type UserDependencies } from './userModule.types'

export type PendingVerificationOffer = {
  readonly challengeId: string
  readonly maskedName: string
  readonly maskedEmail: string | undefined
}

export class OfferPendingVerificationUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly senderPhone: string
    readonly companyId?: string
  }): Promise<PendingVerificationOffer | undefined> {
    const pending = await loadPendingVerification({ dependencies: this.dependencies, ...params })
    if (!pending) return undefined
    const isFirstAsk = await this.dependencies.accountChallenges.markAsked({
      id: pending.challenge.id,
      now: nowOf(this.dependencies),
    })
    if (!isFirstAsk) return undefined
    return {
      challengeId: pending.challenge.id,
      maskedName: maskName(pending.user.name),
      maskedEmail: pending.user.email ? maskEmail(pending.user.email) : undefined,
    }
  }
}
