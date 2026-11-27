/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * "Sim, confirmar" ao bot: o número de quem respondeu é a prova. Continua de uso único, com validade e limite de
 * tentativas (cada resposta conta uma).
 */

import { ConfigMissingError, USER_EVENT } from '@adatechnology/user-contracts'

import { loadPendingVerification } from '../shared/loadPendingVerification'
import { DEFAULT_CODE_MAX_ATTEMPTS } from '../shared/verificationCode'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class ConfirmPendingVerificationUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly senderPhone: string
    readonly challengeId: string
    readonly companyId?: string
  }): Promise<{ readonly outcome: 'verified' | 'rejected'; readonly userId?: string }> {
    const { dependencies } = this
    const config = dependencies.config.phoneVerification
    if (!config) throw new ConfigMissingError('phoneVerification')
    const pending = await loadPendingVerification({ dependencies, ...params })
    if (!pending) return { outcome: 'rejected' }

    const now = nowOf(dependencies)
    const attempts = await dependencies.accountChallenges.registerAttempt({ id: pending.challenge.id })
    if (attempts === undefined) return { outcome: 'rejected' }
    if (attempts > (config.maxAttempts ?? DEFAULT_CODE_MAX_ATTEMPTS)) {
      await dependencies.accountChallenges.consume({ id: pending.challenge.id, now })
      return { outcome: 'rejected' }
    }
    if (!(await dependencies.accountChallenges.consume({ id: pending.challenge.id, now })))
      return { outcome: 'rejected' }

    const companyId = pending.user.companyId ?? undefined
    const updated = await dependencies.users.update({
      companyId,
      id: pending.user.id,
      values: { phoneVerifiedAt: now },
    })
    if (!updated) return { outcome: 'rejected' }
    await runHook({
      dependencies,
      name: USER_EVENT.PHONE_VERIFIED,
      run: () =>
        dependencies.hooks?.onPhoneVerified?.({
          type: USER_EVENT.PHONE_VERIFIED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: pending.user.id,
        }),
    })
    return { outcome: 'verified', userId: pending.user.id }
  }
}
