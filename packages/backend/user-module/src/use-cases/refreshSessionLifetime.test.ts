/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * "Lembrar de mim" gravado no refresh token (servidor) e teto absoluto da sessão.
 */

import { describe, expect, it } from 'bun:test'
import { NotAuthenticatedError } from '@adatechnology/user-contracts'

import {
  createInMemoryAccountChallenges,
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import { TokenService } from '../shared/TokenService'
import { hashToken } from '../shared/tokenHash'
import type { UserRepository } from '../repositories/UserRepository'
import type { AccountChallengeRepository } from '../repositories/AccountChallengeRepository'
import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import type { UserDependencies } from './userModule.types'

const HOUR = 3600
const DAY = 24 * HOUR

type Clock = { current: Date }

function setup(refreshToken: NonNullable<UserDependencies['config']['refreshToken']>) {
  const clock: Clock = { current: new Date('2026-11-26T12:00:00Z') }
  const store = createInMemoryRefreshTokenStore({ now: () => clock.current })
  const dependencies: UserDependencies = {
    users: createInMemoryUsers() as unknown as UserRepository,
    passwordResetTokens: createInMemoryPasswordResetTokens() as unknown as PasswordResetTokenRepository,
    accountChallenges: createInMemoryAccountChallenges() as unknown as AccountChallengeRepository,
    refreshTokenStore: store,
    tokenService: new TokenService({ secret: 'test-secret-test-secret-test-secret' }),
    config: {
      tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
      accessToken: { secret: 'test-secret-test-secret-test-secret' },
      refreshToken,
    },
  }
  const refresh = (token: string, rememberMe?: boolean) =>
    new RefreshSessionUseCase(dependencies).execute({
      refreshToken: token,
      ...(rememberMe === undefined ? {} : { rememberMe }),
    })
  const signIn = async (rememberMe?: boolean) => {
    await new CreateUserUseCase(dependencies)
      .execute({ email: 'ana@example.com', name: 'Ana', password: 'senha-forte-123', role: 'agent' })
      .catch(() => undefined)
    return new AuthenticateLocalUseCase(dependencies).execute({
      email: 'ana@example.com',
      password: 'senha-forte-123',
      ...(rememberMe === undefined ? {} : { rememberMe }),
    })
  }
  const advance = (seconds: number) => {
    clock.current = new Date(clock.current.getTime() + seconds * 1000)
  }
  return { dependencies, store, refresh, signIn, advance }
}

const LIFETIMES = { expiresInSeconds: 30 * DAY, rememberExpiresInSeconds: 90 * DAY, sessionExpiresInSeconds: 2 * HOUR }

describe('lembrar de mim gravado no servidor', () => {
  it('login devolve a escolha e o refresh a herda sem depender do cookie', async () => {
    const { signIn, refresh } = setup(LIFETIMES)
    const remembered = await signIn(true)
    expect(remembered.rememberMe).toBe(true)
    const next = await refresh(remembered.refreshToken)
    expect(next).toMatchObject({ rememberMe: true, refreshExpiresInSeconds: 90 * DAY })

    const sessionOnly = await signIn(false)
    expect(await refresh(sessionOnly.refreshToken)).toMatchObject({
      rememberMe: false,
      refreshExpiresInSeconds: 2 * HOUR,
    })
  })

  it('a dica do cookie não estende uma sessão de navegador', async () => {
    const { signIn, refresh } = setup(LIFETIMES)
    const sessionOnly = await signIn(false)
    const next = await refresh(sessionOnly.refreshToken, true)
    expect(next).toMatchObject({ rememberMe: false, refreshExpiresInSeconds: 2 * HOUR })
  })

  it('token anterior ao registro: a dica do cookie vale uma vez e fica gravada', async () => {
    const { dependencies, signIn, refresh } = setup(LIFETIMES)
    const user = await signIn()
    const legacyToken = await dependencies.refreshTokenStore.issue({ userId: user.user.id, expiresInSeconds: 30 * DAY })

    const migrated = await refresh(legacyToken, true)
    expect(migrated).toMatchObject({ rememberMe: true, refreshExpiresInSeconds: 90 * DAY })
    // Da próxima vez nem precisa de dica (cookie novo não leva prefixo).
    expect(await refresh(migrated.refreshToken)).toMatchObject({ rememberMe: true, refreshExpiresInSeconds: 90 * DAY })
  })

  it('token sem escolha e sem dica mantém a validade de sempre', async () => {
    const { dependencies, signIn, refresh } = setup(LIFETIMES)
    const user = await signIn()
    const legacyToken = await dependencies.refreshTokenStore.issue({ userId: user.user.id, expiresInSeconds: 30 * DAY })
    const next = await refresh(legacyToken)
    expect(next.refreshExpiresInSeconds).toBe(30 * DAY)
    expect(next.rememberMe).toBeUndefined()
  })
})

describe('teto absoluto da sessão', () => {
  const CAPPED = { ...LIFETIMES, absoluteExpiresInSeconds: 100 * DAY }

  it('cada renovação encurta o que resta até o teto, e passado o teto recusa', async () => {
    const { signIn, refresh, advance } = setup({ ...CAPPED, rememberExpiresInSeconds: 60 * DAY })
    let session = await signIn(true)
    expect(session.refreshExpiresInSeconds).toBe(60 * DAY)

    advance(50 * DAY)
    session = await refresh(session.refreshToken)
    expect(session.refreshExpiresInSeconds).toBe(50 * DAY) // restam 50 dos 100: o token novo não passa do teto

    advance(45 * DAY) // 95 dias desde o login: restam 5
    session = await refresh(session.refreshToken)
    expect(session.refreshExpiresInSeconds).toBe(5 * DAY)

    advance(6 * DAY)
    await expect(refresh(session.refreshToken)).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('sessão de navegador também respeita o teto', async () => {
    const { signIn, refresh, advance } = setup({
      ...LIFETIMES,
      sessionExpiresInSeconds: 2 * DAY,
      absoluteExpiresInSeconds: 3 * DAY,
    })
    let session = await signIn(false)
    advance(1.5 * DAY)
    session = await refresh(session.refreshToken)
    expect(session.refreshExpiresInSeconds).toBe(Math.floor(1.5 * DAY))
    advance(1.6 * DAY)
    await expect(refresh(session.refreshToken)).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('token vencido pelo teto não vira "reuso" e não derruba as outras sessões', async () => {
    const { store, signIn, refresh, advance } = setup({ ...LIFETIMES, absoluteExpiresInSeconds: 10 * DAY })
    const old = await signIn(true)
    advance(11 * DAY)
    const other = await signIn(true)

    await expect(refresh(old.refreshToken)).rejects.toBeInstanceOf(NotAuthenticatedError)
    await expect(refresh(old.refreshToken)).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(store.rows.get(hashToken(other.refreshToken))?.revokedAt).toBeNull()
    expect((await refresh(other.refreshToken)).rememberMe).toBe(true)
  })

  it('sem teto configurado a sessão se renova como antes', async () => {
    const { signIn, refresh, advance } = setup(LIFETIMES)
    let session = await signIn(true)
    for (let step = 0; step < 3; step++) {
      advance(80 * DAY)
      session = await refresh(session.refreshToken)
      expect(session.refreshExpiresInSeconds).toBe(90 * DAY)
    }
  })
})
