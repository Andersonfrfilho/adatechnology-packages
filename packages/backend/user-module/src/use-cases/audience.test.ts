/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { InvalidCredentialsError, NotAuthenticatedError } from '@adatechnology/user-contracts'

import type { UserRepository } from '../repositories/UserRepository'
import { createInMemoryRefreshTokenStore, createInMemoryUsers } from '../testing/inMemoryRepositories'
import type { UserRow } from '../schema/schema'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { buildTestDependencies } from './testDependencies'

/** Duas instâncias do módulo sobre as mesmas linhas, uma por audiência. */
function buildTwoAudiences() {
  const sharedRows: UserRow[] = []
  const refreshTokenStore = createInMemoryRefreshTokenStore()
  const build = (audience: string) =>
    buildTestDependencies({
      users: createInMemoryUsers([], audience, sharedRows) as unknown as UserRepository,
      refreshTokenStore,
    })
  return { staff: build('staff'), customers: build('customers'), sharedRows }
}

describe('separação por audiência', () => {
  it('o mesmo e-mail existe nas duas audiências, com senhas diferentes', async () => {
    const { staff, customers, sharedRows } = buildTwoAudiences()

    await new CreateUserUseCase(staff).execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'senha-staff-123',
      role: 'admin',
    })
    await new CreateUserUseCase(customers).execute({
      email: 'ana@example.com',
      name: 'Ana Cliente',
      password: 'senha-cliente-123',
      role: 'guest',
    })

    expect(sharedRows).toHaveLength(2)
    const staffSession = await new AuthenticateLocalUseCase(staff).execute({
      email: 'ana@example.com',
      password: 'senha-staff-123',
    })
    expect(staffSession.user.role).toBe('admin')
    await expect(
      new AuthenticateLocalUseCase(staff).execute({ email: 'ana@example.com', password: 'senha-cliente-123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('dentro de uma audiência o e-mail continua único', async () => {
    const { staff } = buildTwoAudiences()
    const create = new CreateUserUseCase(staff)
    await create.execute({ email: 'ana@example.com', name: 'Ana', password: 'senha-staff-123', role: 'admin' })

    await expect(
      create.execute({ email: 'ana@example.com', name: 'Outra', password: 'senha-staff-123', role: 'admin' }),
    ).rejects.toThrow()
  })

  it('o refresh token de uma audiência não abre sessão na outra', async () => {
    const { staff, customers } = buildTwoAudiences()
    await new CreateUserUseCase(staff).execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'senha-staff-123',
      role: 'admin',
    })
    const session = await new AuthenticateLocalUseCase(staff).execute({
      email: 'ana@example.com',
      password: 'senha-staff-123',
    })

    await expect(
      new RefreshSessionUseCase(customers).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })
})
