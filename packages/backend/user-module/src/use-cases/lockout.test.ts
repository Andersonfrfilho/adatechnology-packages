/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it, spyOn } from 'bun:test'
import { InvalidCredentialsError, type UserHooks, type UserModuleConfig } from '@adatechnology/user-contracts'

import { createInMemoryLockoutStore, createLoginLockout } from '@adatechnology/login-lockout'
import { resolveUserLockoutPolicy } from '../shared/lockoutPolicy'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { buildTestDependencies } from './testDependencies'
import type { UserDependencies } from './userModule.types'

const LOCKOUT_CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'test-secret-test-secret-test-secret' },
  lockout: { maxFailedAttempts: 3, lockMinutes: 15 },
}

const PASSWORD = 'senha-forte-123'

async function setUp(params: { config?: UserModuleConfig; hooks?: UserHooks; now?: () => Date } = {}) {
  const dependencies: UserDependencies = buildTestDependencies({
    config: params.config ?? LOCKOUT_CONFIG,
    ...(params.hooks ? { hooks: params.hooks } : {}),
    ...(params.now ? { clock: { now: params.now } } : {}),
  })
  await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: PASSWORD,
    role: 'staff',
  })
  return { dependencies, authenticate: new AuthenticateLocalUseCase(dependencies) }
}

const signIn = (authenticate: AuthenticateLocalUseCase, password: string) =>
  authenticate.execute({ email: 'ana@example.com', password })

describe('bloqueio por tentativas falhas', () => {
  it('trava no limite: a senha certa deixa de entrar e o erro é o mesmo de credencial errada', async () => {
    const { authenticate } = await setUp()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(signIn(authenticate, 'senha-errada-1')).rejects.toBeInstanceOf(InvalidCredentialsError)
    }

    await expect(signIn(authenticate, PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('emite onLoginFailed a cada falha e onUserLocked uma única vez, na tentativa que cruza o limite', async () => {
    const failed: string[] = []
    const locked: number[] = []
    const { authenticate } = await setUp({
      hooks: {
        onLoginFailed: (event) => void failed.push(event.reason),
        onUserLocked: (event) => void locked.push(event.failedAttempts),
      },
    })

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await signIn(authenticate, 'senha-errada-1').catch(() => undefined)
    }

    expect(failed).toEqual(['invalid_password', 'invalid_password', 'invalid_password', 'user_locked'])
    expect(locked).toEqual([3])
  })

  it('tentativas simultâneas cruzam o limite uma vez só', async () => {
    const locked: number[] = []
    const { authenticate } = await setUp({ hooks: { onUserLocked: (event) => void locked.push(event.failedAttempts) } })

    await Promise.all(Array.from({ length: 10 }, () => signIn(authenticate, 'senha-errada-1').catch(() => undefined)))

    expect(locked).toEqual([3])
  })

  it('o bloqueio expira: depois do prazo a senha certa volta a entrar e zera o contador', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ now: () => current })

    for (let attempt = 0; attempt < 3; attempt += 1) await signIn(authenticate, 'x-errada-123').catch(() => undefined)
    await expect(signIn(authenticate, PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError)

    current = new Date(current.getTime() + 16 * 60_000)
    const session = await signIn(authenticate, PASSWORD)

    expect(session.user.email).toBe('ana@example.com')
    const stored = await dependencies.users.findByEmail({ companyId: undefined, email: 'ana@example.com' })
    expect(stored?.failedLoginAttempts).toBe(0)
    expect(stored?.lockedUntil).toBeNull()
  })

  it('conta bloqueada não estende o prazo por tentativa de quem está de fora', async () => {
    const current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ now: () => current })

    for (let attempt = 0; attempt < 3; attempt += 1) await signIn(authenticate, 'x-errada-123').catch(() => undefined)
    const before = (await dependencies.users.findByEmail({ companyId: undefined, email: 'ana@example.com' }))
      ?.lockedUntil
    await signIn(authenticate, 'x-errada-123').catch(() => undefined)
    const after = (await dependencies.users.findByEmail({ companyId: undefined, email: 'ana@example.com' }))
      ?.lockedUntil

    expect(after?.getTime()).toBe(before?.getTime())
  })

  it('sem `lockout` configurado nada trava, por mais que se erre', async () => {
    const { authenticate } = await setUp({
      config: { tenancy: LOCKOUT_CONFIG.tenancy, accessToken: LOCKOUT_CONFIG.accessToken },
    })

    for (let attempt = 0; attempt < 10; attempt += 1) await signIn(authenticate, 'x-errada-123').catch(() => undefined)

    expect((await signIn(authenticate, PASSWORD)).user.email).toBe('ana@example.com')
  })

  it('conta desconhecida e conta bloqueada gastam uma verificação de hash, como a senha errada', async () => {
    const { authenticate } = await setUp()
    const verify = spyOn(Bun.password, 'verify')

    await authenticate.execute({ email: 'ninguem@example.com', password: PASSWORD }).catch(() => undefined)
    expect(verify).toHaveBeenCalledTimes(1)

    for (let attempt = 0; attempt < 3; attempt += 1) await signIn(authenticate, 'x-errada-123').catch(() => undefined)
    verify.mockClear()
    await signIn(authenticate, PASSWORD).catch(() => undefined)
    expect(verify).toHaveBeenCalledTimes(1)

    verify.mockRestore()
  })

  it('o evento de falha de conta desconhecida não carrega userId', async () => {
    const events: { reason: string; userId?: string }[] = []
    const { authenticate } = await setUp({
      hooks: { onLoginFailed: (event) => void events.push({ reason: event.reason, userId: event.userId }) },
    })

    await authenticate.execute({ email: 'ninguem@example.com', password: PASSWORD }).catch(() => undefined)

    expect(events).toEqual([{ reason: 'user_not_found', userId: undefined }])
  })
})

describe('bloqueio progressivo', () => {
  const PROGRESSIVE: UserModuleConfig = {
    ...LOCKOUT_CONFIG,
    lockout: {
      maxFailedAttempts: 3,
      lockMinutes: 15,
      lockMultiplier: 2,
      maxLockMinutes: 50,
      forgiveAfterMinutes: 1440,
    },
  }

  async function lockAndMeasure(params: {
    authenticate: AuthenticateLocalUseCase
    dependencies: UserDependencies
    now: Date
  }) {
    for (let attempt = 0; attempt < 3; attempt += 1)
      await signIn(params.authenticate, 'x-errada-123').catch(() => undefined)
    const stored = await params.dependencies.users.findByEmail({ companyId: undefined, email: 'ana@example.com' })
    return Math.round(((stored?.lockedUntil?.getTime() ?? 0) - params.now.getTime()) / 60_000)
  }

  it('cada bloqueio dura o dobro do anterior, até o teto', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ config: PROGRESSIVE, now: () => current })

    const minutes: number[] = []
    for (let round = 0; round < 4; round += 1) {
      minutes.push(await lockAndMeasure({ authenticate, dependencies, now: current }))
      current = new Date(current.getTime() + (minutes.at(-1) ?? 0) * 60_000 + 1000)
    }

    expect(minutes).toEqual([15, 30, 50, 50])
  })

  it('um dia sem falhas perdoa: o nível volta ao primeiro bloqueio', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ config: PROGRESSIVE, now: () => current })
    await lockAndMeasure({ authenticate, dependencies, now: current })
    current = new Date(current.getTime() + 25 * 60 * 60_000)

    expect(await lockAndMeasure({ authenticate, dependencies, now: current })).toBe(15)
  })

  it('login com sucesso zera o nível', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ config: PROGRESSIVE, now: () => current })
    await lockAndMeasure({ authenticate, dependencies, now: current })
    current = new Date(current.getTime() + 16 * 60_000)
    await signIn(authenticate, PASSWORD)

    expect(await lockAndMeasure({ authenticate, dependencies, now: current })).toBe(15)
  })

  it('sem lockMultiplier a duração continua fixa', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { authenticate, dependencies } = await setUp({ now: () => current })

    const first = await lockAndMeasure({ authenticate, dependencies, now: current })
    current = new Date(current.getTime() + 16 * 60_000)
    const second = await lockAndMeasure({ authenticate, dependencies, now: current })

    expect([first, second]).toEqual([15, 15])
  })
})

describe('bloqueio de e-mail que não existe', () => {
  const GUARDED: UserModuleConfig = {
    ...LOCKOUT_CONFIG,
    lockout: { maxFailedAttempts: 3, lockMinutes: 15, identifierSecret: 'segredo-com-tamanho-suficiente' },
  }

  function withUnknownLockout(dependencies: UserDependencies): AuthenticateLocalUseCase {
    return new AuthenticateLocalUseCase({
      ...dependencies,
      unknownIdentifierLockout: createLoginLockout({
        store: createInMemoryLockoutStore(),
        secret: GUARDED.lockout?.identifierSecret ?? '',
        policy: resolveUserLockoutPolicy(GUARDED.lockout as NonNullable<UserModuleConfig['lockout']>),
      }),
    })
  }

  it('depois do limite o e-mail fantasma recusa com o mesmo erro, e o evento passa a dizer user_locked', async () => {
    const failed: string[] = []
    const { dependencies } = await setUp({
      config: GUARDED,
      hooks: { onLoginFailed: (event) => void failed.push(event.reason) },
    })
    const authenticate = withUnknownLockout(dependencies)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(authenticate.execute({ email: 'fantasma@example.com', password: PASSWORD })).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      )
    }

    expect(failed).toEqual(['user_not_found', 'user_not_found', 'user_not_found', 'user_locked'])
  })

  it('conta que existe segue o caminho de sempre', async () => {
    const { dependencies } = await setUp({ config: GUARDED })
    const authenticate = withUnknownLockout(dependencies)

    expect((await signIn(authenticate, PASSWORD)).user.email).toBe('ana@example.com')
  })
})
