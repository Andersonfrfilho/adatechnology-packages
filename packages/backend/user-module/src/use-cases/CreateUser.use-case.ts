/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { EmailAlreadyExistsError, USER_EVENT, type UserProfile } from '@adatechnology/user-contracts'

import { LOCAL_PROVIDER_ID } from '../shared/constants'
import { isUniqueViolation } from '../shared/databaseErrors'
import { toUserProfile } from '../shared/toContract'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class CreateUserUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly email: string
    readonly name: string
    readonly password: string
    readonly role: string
    readonly companyId?: string
  }): Promise<UserProfile> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })

    const existing = await this.dependencies.users.findByEmail({ companyId, email: params.email })
    if (existing) throw new EmailAlreadyExistsError()

    const passwordHash = await Bun.password.hash(params.password)

    // O pré-check acima não fecha a corrida entre dois cadastros simultâneos; o índice único fecha.
    const row = await this.dependencies.users
      .create({
        companyId,
        email: params.email,
        name: params.name,
        passwordHash,
        role: params.role,
        providerId: LOCAL_PROVIDER_ID,
        isActive: true,
      })
      .catch((error: unknown) => {
        throw isUniqueViolation(error) ? new EmailAlreadyExistsError() : error
      })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.USER_CREATED,
      run: () =>
        this.dependencies.hooks?.onUserCreated?.({
          type: USER_EVENT.USER_CREATED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: row.id,
          email: row.email,
        }),
    })

    return toUserProfile(row)
  }
}
