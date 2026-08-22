/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Sessão (refresh/logout), perfil e listagem — comportamento dos casos de uso sem Postgres,
 * mesmo padrão de dublê em memória de `authentication.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import { NotAuthenticatedError, UserNotFoundError } from '@adatechnology/user-contracts'

import {
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import { TokenService } from '../shared/TokenService'
import type { UserRepository } from '../repositories/UserRepository'
import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { GetProfileUseCase } from './GetProfile.use-case'
import { ListUsersUseCase } from './ListUsers.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { SignOutUseCase } from './SignOut.use-case'
import { UpdateProfileUseCase } from './UpdateProfile.use-case'
import type { UserDependencies } from './userModule.types'

function buildDependencies(overrides: Partial<UserDependencies> = {}): UserDependencies {
  return {
    users: createInMemoryUsers() as unknown as UserRepository,
    passwordResetTokens: createInMemoryPasswordResetTokens() as unknown as PasswordResetTokenRepository,
    refreshTokenStore: createInMemoryRefreshTokenStore(),
    tokenService: new TokenService({ secret: 'test-secret-test-secret-test-secret' }),
    config: {
      tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
      accessToken: { secret: 'test-secret-test-secret-test-secret' },
    },
    ...overrides,
  }
}

async function createAndSignIn(dependencies: UserDependencies) {
  await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: 'senha-forte-123',
    role: 'agent',
  })
  return new AuthenticateLocalUseCase(dependencies).execute({ email: 'ana@example.com', password: 'senha-forte-123' })
}

describe('RefreshSessionUseCase', () => {
  it('rotaciona o refresh token e emite um novo access token', async () => {
    const dependencies = buildDependencies()
    const session = await createAndSignIn(dependencies)

    const refreshed = await new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken })

    expect(refreshed.accessToken).toBeTruthy()
    expect(refreshed.refreshToken).not.toBe(session.refreshToken)
    expect(refreshed.user.email).toBe('ana@example.com')
  })

  it('o refresh token antigo não serve mais depois da rotação (token só serve uma vez)', async () => {
    const dependencies = buildDependencies()
    const session = await createAndSignIn(dependencies)

    await new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken })

    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('refresh token inexistente lança NotAuthenticatedError', async () => {
    const dependencies = buildDependencies()
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: 'nunca-emitido' }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })
})

describe('SignOutUseCase', () => {
  it('revoga o refresh token — depois do logout ele não serve mais para refresh', async () => {
    const dependencies = buildDependencies()
    const session = await createAndSignIn(dependencies)

    await new SignOutUseCase(dependencies).execute({ refreshToken: session.refreshToken })

    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('revogar um token que já não existe não lança erro (idempotente)', async () => {
    const dependencies = buildDependencies()
    await expect(new SignOutUseCase(dependencies).execute({ refreshToken: 'nunca-emitido' })).resolves.toBeUndefined()
  })
})

describe('GetProfileUseCase', () => {
  it('retorna o perfil do usuário existente', async () => {
    const dependencies = buildDependencies()
    const session = await createAndSignIn(dependencies)

    const profile = await new GetProfileUseCase(dependencies).execute({ id: session.user.id })

    expect(profile.email).toBe('ana@example.com')
  })

  it('usuário inexistente lança UserNotFoundError', async () => {
    const dependencies = buildDependencies()
    await expect(new GetProfileUseCase(dependencies).execute({ id: 'id-inexistente' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    )
  })
})

describe('UpdateProfileUseCase', () => {
  it('atualiza o nome e dispara onProfileUpdated', async () => {
    const events: string[] = []
    const dependencies = buildDependencies({
      hooks: { onProfileUpdated: (event) => void events.push(event.user.name) },
    })
    const session = await createAndSignIn(dependencies)

    const profile = await new UpdateProfileUseCase(dependencies).execute({ id: session.user.id, name: 'Ana Paula' })

    expect(profile.name).toBe('Ana Paula')
    expect(events).toEqual(['Ana Paula'])
  })

  it('usuário inexistente lança UserNotFoundError', async () => {
    const dependencies = buildDependencies()
    await expect(
      new UpdateProfileUseCase(dependencies).execute({ id: 'id-inexistente', name: 'Qualquer' }),
    ).rejects.toBeInstanceOf(UserNotFoundError)
  })
})

describe('ListUsersUseCase', () => {
  it('pagina os usuários e devolve o total', async () => {
    const dependencies = buildDependencies()
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
      await new CreateUserUseCase(dependencies).execute({
        email,
        name: email,
        password: 'senha-forte-123',
        role: 'agent',
      })
    }

    const page = await new ListUsersUseCase(dependencies).execute({ page: 1, perPage: 2 })

    expect(page.data).toHaveLength(2)
    expect(page.pagination.total).toBe(3)
  })
})
