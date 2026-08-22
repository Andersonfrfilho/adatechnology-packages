/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  InvalidCredentialsError,
  ProviderDisabledError,
  USER_EVENT,
  type UserSession,
} from '@adatechnology/user-contracts'

import { DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS, KEYCLOAK_PROVIDER_ID } from '../shared/constants'
import { applyAttributeMapping, DEFAULT_KEYCLOAK_ATTRIBUTE_MAPPING } from '../shared/attributeMapping'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class AuthenticateKeycloakUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly accessToken: string
    readonly ipAddress?: string
    readonly companyId?: string
  }): Promise<UserSession> {
    if (!this.dependencies.keycloak) throw new ProviderDisabledError()

    const claims = await this.dependencies.keycloak.verify(params.accessToken)
    if (!claims || typeof claims.sub !== 'string') {
      await runHook({
        dependencies: this.dependencies,
        name: USER_EVENT.LOGIN_FAILED,
        run: () =>
          this.dependencies.hooks?.onLoginFailed?.({
            type: USER_EVENT.LOGIN_FAILED,
            companyId: params.companyId,
            occurredAt: nowOf(this.dependencies),
            email: '',
            ipAddress: params.ipAddress ?? '',
            reason: 'keycloak_token_invalid',
          }),
      })
      throw new InvalidCredentialsError()
    }

    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const mapping = this.dependencies.config.keycloak?.attributeMapping ?? DEFAULT_KEYCLOAK_ATTRIBUTE_MAPPING
    const attributes = applyAttributeMapping({ claims, mapping })

    const externalId = claims.sub
    const existing = await this.dependencies.users.findByProviderExternalId({
      companyId,
      providerId: KEYCLOAK_PROVIDER_ID,
      externalId,
    })

    const user =
      existing ??
      (await this.dependencies.users.create({
        companyId,
        email: attributes.email,
        name: attributes.name,
        passwordHash: null,
        role: attributes.role,
        providerId: KEYCLOAK_PROVIDER_ID,
        externalId,
        isActive: true,
      }))

    if (!existing) {
      await runHook({
        dependencies: this.dependencies,
        name: USER_EVENT.USER_CREATED,
        run: () =>
          this.dependencies.hooks?.onUserCreated?.({
            type: USER_EVENT.USER_CREATED,
            companyId,
            occurredAt: nowOf(this.dependencies),
            userId: user.id,
            email: user.email,
          }),
      })
    }

    if (!user.isActive) throw new InvalidCredentialsError()

    const profile = toUserProfile(user)
    const { accessToken, expiresInSeconds } = await this.dependencies.tokenService.sign(profile)
    const refreshExpiresInSeconds =
      this.dependencies.config.refreshToken?.expiresInSeconds ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS
    const refreshToken = await this.dependencies.refreshTokenStore.issue({
      userId: user.id,
      expiresInSeconds: refreshExpiresInSeconds,
    })

    await this.dependencies.users.update({ companyId, id: user.id, values: { lastSeenAt: nowOf(this.dependencies) } })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.LOGIN_SUCCEEDED,
      run: () =>
        this.dependencies.hooks?.onLoginSucceeded?.({
          type: USER_EVENT.LOGIN_SUCCEEDED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: user.id,
          email: user.email,
          ipAddress: params.ipAddress ?? '',
        }),
    })

    return { accessToken, expiresInSeconds, refreshToken, refreshExpiresInSeconds, user: profile }
  }
}
