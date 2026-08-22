/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Provedor Keycloak — mapeamento de claims e find-or-create do usuário "sombra" por
 * `(providerId='keycloak', externalId=sub)`, sem depender de `@adatechnology/auth-keycloak` real:
 * o dublê injetado só precisa satisfazer `KeycloakVerifierPort.verify()`.
 */

import { describe, expect, it } from 'bun:test'
import { InvalidCredentialsError, ProviderDisabledError } from '@adatechnology/user-contracts'

import {
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import { TokenService } from '../shared/TokenService'
import type { UserRepository } from '../repositories/UserRepository'
import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import type { KeycloakVerifierPort } from '../shared/keycloak.types'
import { AuthenticateKeycloakUseCase } from './AuthenticateKeycloak.use-case'
import type { UserDependencies } from './userModule.types'

function buildKeycloakVerifier(claims: Record<string, unknown> | undefined): KeycloakVerifierPort {
  return { verify: async () => claims }
}

function buildDependencies(overrides: Partial<UserDependencies> = {}): UserDependencies {
  return {
    users: createInMemoryUsers() as unknown as UserRepository,
    passwordResetTokens: createInMemoryPasswordResetTokens() as unknown as PasswordResetTokenRepository,
    refreshTokenStore: createInMemoryRefreshTokenStore(),
    tokenService: new TokenService({ secret: 'test-secret-test-secret-test-secret' }),
    config: {
      tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
      accessToken: { secret: 'test-secret-test-secret-test-secret' },
      // O papel é do vocabulário do host — o módulo não tem default para ele.
      keycloak: {
        realm: 'ada',
        authServerUrl: 'https://kc.example.com',
        clientId: 'painel',
        attributeMapping: { email: { from: 'email' }, name: { from: 'name' }, role: { value: 'agent' } },
      },
    },
    keycloak: buildKeycloakVerifier({ sub: 'keycloak-sub-1', email: 'ana@example.com', name: 'Ana' }),
    ...overrides,
  }
}

describe('AuthenticateKeycloakUseCase', () => {
  it('lança ProviderDisabledError quando o host não injetou o verificador Keycloak', async () => {
    const dependencies = buildDependencies({ keycloak: undefined })
    await expect(new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'any' })).rejects.toBeInstanceOf(
      ProviderDisabledError,
    )
  })

  it('token inválido (verify devolve undefined): lança InvalidCredentialsError', async () => {
    const dependencies = buildDependencies({ keycloak: buildKeycloakVerifier(undefined) })
    await expect(
      new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'invalido' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('claims sem sub (string): lança InvalidCredentialsError', async () => {
    const dependencies = buildDependencies({ keycloak: buildKeycloakVerifier({ email: 'ana@example.com' }) })
    await expect(
      new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'sem-sub' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('primeiro login: cria usuário sombra mapeando email/name/role das claims', async () => {
    const events: string[] = []
    const dependencies = buildDependencies({ hooks: { onUserCreated: (event) => void events.push(event.email) } })

    const session = await new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'token-valido' })

    expect(session.user.email).toBe('ana@example.com')
    expect(session.user.name).toBe('Ana')
    expect(session.user.role).toBe('agent')
    expect(events).toEqual(['ana@example.com'])
    expect(session.accessToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()
  })

  it('segundo login com o mesmo sub: reaproveita o usuário já criado, sem duplicar e sem novo onUserCreated', async () => {
    const createdEvents: string[] = []
    const dependencies = buildDependencies({
      hooks: { onUserCreated: (event) => void createdEvents.push(event.email) },
    })

    const first = await new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'token-valido' })
    const second = await new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'token-valido' })

    expect(second.user.id).toBe(first.user.id)
    expect(createdEvents).toHaveLength(1)

    const users = (dependencies.users as unknown as ReturnType<typeof createInMemoryUsers>).rows
    expect(users).toHaveLength(1)
  })

  it('respeita attributeMapping customizado do host, incluindo role fixo por value', async () => {
    const dependencies = buildDependencies({
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'test-secret-test-secret-test-secret' },
        keycloak: {
          realm: 'ada',
          authServerUrl: 'https://keycloak.example.com',
          clientId: 'ada-panel',
          attributeMapping: {
            email: { from: 'email' },
            name: { from: 'preferred_username' },
            role: { value: 'admin' },
          },
        },
      },
      keycloak: buildKeycloakVerifier({
        sub: 'keycloak-sub-2',
        email: 'bruno@example.com',
        preferred_username: 'bruno',
      }),
    })

    const session = await new AuthenticateKeycloakUseCase(dependencies).execute({ accessToken: 'token-valido' })

    expect(session.user.name).toBe('bruno')
    expect(session.user.role).toBe('admin')
  })
})
