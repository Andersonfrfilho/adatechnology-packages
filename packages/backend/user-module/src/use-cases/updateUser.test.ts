/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { NotAuthenticatedError, UserNotFoundError, type UserUpdatedEvent } from '@adatechnology/user-contracts'

import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { buildTestDependencies } from './testDependencies'
import { UpdateUserUseCase } from './UpdateUser.use-case'

const PASSWORD = 'senha-forte-123'

async function setUp(events: UserUpdatedEvent[] = []) {
  const dependencies = buildTestDependencies({ hooks: { onUserUpdated: (event) => void events.push(event) } })
  const created = await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: PASSWORD,
    role: 'agent',
  })
  const session = await new AuthenticateLocalUseCase(dependencies).execute({
    email: 'ana@example.com',
    password: PASSWORD,
  })
  return { dependencies, created, session, updateUser: new UpdateUserUseCase(dependencies) }
}

describe('UpdateUserUseCase', () => {
  it('troca o papel e revoga os refresh tokens do usuário', async () => {
    const { dependencies, created, session, updateUser } = await setUp()

    const profile = await updateUser.execute({ id: created.id, role: 'manager' })

    expect(profile.role).toBe('manager')
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('desativar revoga as sessões e impede novo login — o usuário continua existindo', async () => {
    const { dependencies, created, session, updateUser } = await setUp()

    const profile = await updateUser.execute({ id: created.id, isActive: false })

    expect(profile.isActive).toBe(false)
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
    await expect(
      new AuthenticateLocalUseCase(dependencies).execute({ email: 'ana@example.com', password: PASSWORD }),
    ).rejects.toThrow()
    expect(await dependencies.users.findById({ companyId: undefined, id: created.id })).toBeDefined()
  })

  it('reativar devolve o acesso e limpa um bloqueio pendente', async () => {
    const { dependencies, created, updateUser } = await setUp()
    await updateUser.execute({ id: created.id, isActive: false })
    await dependencies.users.update({
      companyId: undefined,
      id: created.id,
      values: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 3_600_000) },
    })

    const profile = await updateUser.execute({ id: created.id, isActive: true })

    expect(profile.isActive).toBe(true)
    expect(profile.lockedUntil).toBeUndefined()
    const session = await new AuthenticateLocalUseCase(dependencies).execute({
      email: 'ana@example.com',
      password: PASSWORD,
    })
    expect(session.user.id).toBe(created.id)
  })

  it('`unlock` limpa só o bloqueio e não derruba as sessões', async () => {
    const { dependencies, created, session, updateUser } = await setUp()
    await dependencies.users.update({
      companyId: undefined,
      id: created.id,
      values: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 3_600_000) },
    })

    await updateUser.execute({ id: created.id, unlock: true })

    const refreshed = await new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken })
    expect(refreshed.user.id).toBe(created.id)
    const stored = await dependencies.users.findById({ companyId: undefined, id: created.id })
    expect(stored?.lockedUntil).toBeNull()
  })

  it('pedir o que já é verdade não grava, não revoga e não emite evento', async () => {
    const events: UserUpdatedEvent[] = []
    const { dependencies, created, session, updateUser } = await setUp(events)

    await updateUser.execute({ id: created.id, role: 'agent', isActive: true })

    expect(events).toHaveLength(0)
    expect(await new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken })).toBeDefined()
  })

  it('o evento descreve o que mudou e se as sessões foram revogadas', async () => {
    const events: UserUpdatedEvent[] = []
    const { created, updateUser } = await setUp(events)

    await updateUser.execute({ id: created.id, role: 'manager', isActive: false })

    expect(events[0]?.changes).toEqual({
      role: { from: 'agent', to: 'manager' },
      isActive: { from: true, to: false },
      sessionsRevoked: true,
    })
  })

  it('usuário inexistente lança UserNotFoundError', async () => {
    const { updateUser } = await setUp()
    await expect(updateUser.execute({ id: 'nao-existe', role: 'x' })).rejects.toBeInstanceOf(UserNotFoundError)
  })
})
