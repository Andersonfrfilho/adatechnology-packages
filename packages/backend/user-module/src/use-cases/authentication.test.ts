/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { EmailAlreadyExistsError, InvalidCredentialsError } from '@adatechnology/user-contracts'

import {
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import { TokenService } from '../shared/TokenService'
import { UserRepository } from '../repositories/UserRepository'
import { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
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

describe('CreateUserUseCase', () => {
  it('cria usuário local com senha hasheada', async () => {
    const dependencies = buildDependencies()
    const createUser = new CreateUserUseCase(dependencies)

    const profile = await createUser.execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'senha-forte-123',
      role: 'agent',
    })

    expect(profile.email).toBe('ana@example.com')
    expect(profile.role).toBe('agent')
  })

  it('rejeita e-mail já cadastrado', async () => {
    const dependencies = buildDependencies()
    const createUser = new CreateUserUseCase(dependencies)

    await createUser.execute({ email: 'ana@example.com', name: 'Ana', password: 'senha-forte-123', role: 'agent' })

    await expect(
      createUser.execute({ email: 'ana@example.com', name: 'Outra Ana', password: 'outra-senha-123', role: 'agent' }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError)
  })
})

describe('AuthenticateLocalUseCase', () => {
  it('autentica com credenciais válidas e emite sessão', async () => {
    const dependencies = buildDependencies()
    await new CreateUserUseCase(dependencies).execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'senha-forte-123',
      role: 'agent',
    })

    const session = await new AuthenticateLocalUseCase(dependencies).execute({
      email: 'ana@example.com',
      password: 'senha-forte-123',
    })

    expect(session.accessToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()
    expect(session.user.email).toBe('ana@example.com')
  })

  it('rejeita senha incorreta sem revelar se o e-mail existe', async () => {
    const dependencies = buildDependencies()
    await new CreateUserUseCase(dependencies).execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'senha-forte-123',
      role: 'agent',
    })

    await expect(
      new AuthenticateLocalUseCase(dependencies).execute({ email: 'ana@example.com', password: 'senha-errada' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('rejeita e-mail inexistente com o mesmo erro de senha incorreta', async () => {
    const dependencies = buildDependencies()

    await expect(
      new AuthenticateLocalUseCase(dependencies).execute({
        email: 'inexistente@example.com',
        password: 'qualquer-coisa',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })
})
