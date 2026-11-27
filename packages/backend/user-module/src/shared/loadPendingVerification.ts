/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quem tem uma verificação de telefone pendente, achado PELO NÚMERO de quem escreveu (esse número é a prova): conta
 * pelo telefone, ainda não verificada, com código vivo (não usado, não vencido) preso a este mesmo número.
 */

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import type { AccountChallengeRow, UserRow } from '../schema/schema'
import { nowOf, type UserDependencies } from '../use-cases/userModule.types'
import { normalizePhone } from './phone'
import { resolveScopeCompanyId } from './tenancy'

export type PendingVerification = { readonly user: UserRow; readonly challenge: AccountChallengeRow }

export async function loadPendingVerification(params: {
  readonly dependencies: UserDependencies
  readonly senderPhone: string
  readonly companyId?: string | undefined
  readonly challengeId?: string | undefined
}): Promise<PendingVerification | undefined> {
  const { dependencies } = params
  const phone = normalizePhone({ raw: params.senderPhone, config: dependencies.config.phone })
  if (!phone) return undefined
  const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
  const user = await dependencies.users.findByPhone({ companyId, phone })
  if (!user?.phone || user.phoneVerifiedAt) return undefined
  const challenge = await dependencies.accountChallenges.findLatest({
    userId: user.id,
    kind: ACCOUNT_CHALLENGE_KIND.PHONE_CODE,
  })
  const isLive =
    challenge && !challenge.consumedAt && challenge.expiresAt > nowOf(dependencies) && challenge.target === user.phone
  if (!isLive) return undefined
  if (params.challengeId && challenge.id !== params.challengeId) return undefined
  return { user, challenge }
}
