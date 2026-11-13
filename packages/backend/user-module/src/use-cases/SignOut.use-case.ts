/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { hashToken } from '../shared/tokenHash'
import type { UserDependencies } from './userModule.types'

export class SignOutUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly refreshToken: string }): Promise<void> {
    await this.dependencies.refreshTokenStore.revoke({ tokenHash: hashToken(params.refreshToken) })
  }
}
