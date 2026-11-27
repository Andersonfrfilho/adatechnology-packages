/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Montagem de `UserDependencies` sobre dublês em memória, compartilhada pelas suítes de caso de uso.
 */

import type { AccountChallengeRepository } from '../repositories/AccountChallengeRepository'
import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import type { UserRepository } from '../repositories/UserRepository'
import { TokenService } from '../shared/TokenService'
import {
  createInMemoryAccountChallenges,
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import type { UserDependencies } from './userModule.types'

const SECRET = 'test-secret-test-secret-test-secret'

export function buildTestDependencies(overrides: Partial<UserDependencies> = {}): UserDependencies {
  return {
    users: createInMemoryUsers() as unknown as UserRepository,
    passwordResetTokens: createInMemoryPasswordResetTokens() as unknown as PasswordResetTokenRepository,
    accountChallenges: createInMemoryAccountChallenges() as unknown as AccountChallengeRepository,
    refreshTokenStore: createInMemoryRefreshTokenStore(),
    tokenService: new TokenService({ secret: SECRET }),
    config: { tenancy: { mode: 'single', defaultCompanyId: 'company-a' }, accessToken: { secret: SECRET } },
    ...overrides,
  }
}
