/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import {
  NotAuthenticatedError,
  PasswordNotLocalError,
  UserNotFoundError,
  type PasswordChangedEvent,
} from '@adatechnology/user-contracts'

import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { SetUserPasswordUseCase } from './SetUserPassword.use-case'
import { buildTestDependencies } from './testDependencies'

const OLD_PASSWORD = 'senha-antiga-123'
const NEW_PASSWORD = 'senha-nova-456'

async function setUp() {
  const events: PasswordChangedEvent[] = []
  const dependencies = buildTestDependencies({ hooks: { onPasswordChanged: (event) => void events.push(event) } })
  const created = await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: OLD_PASSWORD,
    role: 'agent',
  })
  const session = await new AuthenticateLocalUseCase(dependencies).execute({
    email: 'ana@example.com',
    password: OLD_PASSWORD,
  })
  return { dependencies, created, session, events, setPassword: new SetUserPasswordUseCase(dependencies) }
}

describe('SetUserPasswordUseCase', () => {
  it('troca a senha: a nova entra, a antiga não', async () => {
    const { dependencies, created, setPassword } = await setUp()

    await setPassword.execute({ id: created.id, password: NEW_PASSWORD, actorUserId: 'admin-1' })

    const login = new AuthenticateLocalUseCase(dependencies)
    await expect(login.execute({ email: 'ana@example.com', password: NEW_PASSWORD })).resolves.toBeDefined()
    await expect(login.execute({ email: 'ana@example.com', password: OLD_PASSWORD })).rejects.toThrow()
  })

  it('revoga as sessões abertas da pessoa', async () => {
    const { dependencies, created, session, setPassword } = await setUp()

    await setPassword.execute({ id: created.id, password: NEW_PASSWORD })

    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('avisa o host com quem trocou, para a auditoria', async () => {
    const { created, events, setPassword } = await setUp()

    await setPassword.execute({ id: created.id, password: NEW_PASSWORD, actorUserId: 'admin-1' })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ userId: created.id, changedByUserId: 'admin-1' })
  })

  it('usuário inexistente é 404', async () => {
    const { setPassword } = await setUp()

    await expect(setPassword.execute({ id: 'nao-existe', password: NEW_PASSWORD })).rejects.toBeInstanceOf(
      UserNotFoundError,
    )
  })

  it('conta de provedor externo não ganha senha local', async () => {
    const { dependencies, created, setPassword } = await setUp()
    await dependencies.users.update({ companyId: undefined, id: created.id, values: { providerId: 'keycloak' } })

    await expect(setPassword.execute({ id: created.id, password: NEW_PASSWORD })).rejects.toBeInstanceOf(
      PasswordNotLocalError,
    )
  })
})
