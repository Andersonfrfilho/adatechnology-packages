/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Confere o código digitado: expira, limita tentativas e só vale para o número atual da conta.
 */

import {
  ConfigMissingError,
  USER_EVENT,
  UserNotFoundError,
  VerificationCodeInvalidError,
  VerificationRateLimitedError,
  type UserProfile,
} from '@adatechnology/user-contracts'

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { DEFAULT_CODE_MAX_ATTEMPTS, hashVerificationCode, isSameHash } from '../shared/verificationCode'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class VerifyPhoneUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly id: string
    readonly code: string
    readonly companyId?: string
  }): Promise<UserProfile> {
    const { dependencies } = this
    const config = dependencies.config.phoneVerification
    if (!config) throw new ConfigMissingError('phoneVerification')
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const row = await dependencies.users.findById({ companyId, id: params.id })
    if (!row?.phone) throw new UserNotFoundError()
    if (row.phoneVerifiedAt) return toUserProfile(row)

    const now = nowOf(dependencies)
    const challenge = await dependencies.accountChallenges.findLatest({
      userId: row.id,
      kind: ACCOUNT_CHALLENGE_KIND.PHONE_CODE,
    })
    const isUsable = challenge && !challenge.consumedAt && challenge.expiresAt > now && challenge.target === row.phone
    if (!isUsable) throw new VerificationCodeInvalidError()

    const attempts = await dependencies.accountChallenges.registerAttempt({ id: challenge.id })
    const maxAttempts = config.maxAttempts ?? DEFAULT_CODE_MAX_ATTEMPTS
    if (attempts === undefined) throw new VerificationCodeInvalidError()
    if (attempts > maxAttempts) {
      await dependencies.accountChallenges.consume({ id: challenge.id, now })
      throw new VerificationRateLimitedError()
    }

    const expected = hashVerificationCode({
      code: params.code,
      userId: row.id,
      phone: row.phone,
      secret: config.hashSecret,
    })
    if (!isSameHash(expected, challenge.secretHash)) throw new VerificationCodeInvalidError()
    if (!(await dependencies.accountChallenges.consume({ id: challenge.id, now })))
      throw new VerificationCodeInvalidError()

    const updated = await dependencies.users.update({ companyId, id: row.id, values: { phoneVerifiedAt: now } })
    if (!updated) throw new UserNotFoundError()
    await runHook({
      dependencies,
      name: USER_EVENT.PHONE_VERIFIED,
      run: () =>
        dependencies.hooks?.onPhoneVerified?.({
          type: USER_EVENT.PHONE_VERIFIED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: row.id,
        }),
    })
    return toUserProfile(updated)
  }
}
