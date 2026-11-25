/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { NotAuthenticatedError, type RefreshReuseDetectedEvent } from '@adatechnology/user-contracts'

import { createInMemoryRefreshTokenStore } from '../testing/inMemoryRepositories'
import { hashToken } from '../shared/tokenHash'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { buildTestDependencies } from './testDependencies'
import type { UserDependencies } from './userModule.types'

const PASSWORD = 'senha-forte-123'

async function setUp(params: { reuseGraceSeconds?: number; now?: () => Date } = {}) {
  const events: RefreshReuseDetectedEvent[] = []
  const dependencies: UserDependencies = buildTestDependencies({
    refreshTokenStore: createInMemoryRefreshTokenStore(params.now ? { now: params.now } : {}),
    hooks: { onRefreshReuseDetected: (event) => void events.push(event) },
    config: {
      tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
      accessToken: { secret: 'test-secret-test-secret-test-secret' },
      refreshToken: params.reuseGraceSeconds === undefined ? {} : { reuseGraceSeconds: params.reuseGraceSeconds },
    },
  })
  await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: PASSWORD,
    role: 'agent',
  })
  const authenticate = () =>
    new AuthenticateLocalUseCase(dependencies).execute({ email: 'ana@example.com', password: PASSWORD })
  return { dependencies, events, authenticate, refresh: new RefreshSessionUseCase(dependencies) }
}

describe('detecção de reuso do refresh token', () => {
  it('reapresentar o token antigo (fora da graça) revoga TODAS as sessões do usuário e avisa o host', async () => {
    let current = new Date('2026-09-01T12:00:00.000Z')
    const { events, authenticate, refresh } = await setUp({ reuseGraceSeconds: 5, now: () => current })
    const phone = await authenticate()
    const laptop = await authenticate()

    const rotated = await refresh.execute({ refreshToken: phone.refreshToken })
    current = new Date(current.getTime() + 30_000)

    await expect(refresh.execute({ refreshToken: phone.refreshToken })).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(events).toHaveLength(1)
    expect(events[0]?.userId).toBe(phone.user.id)

    // o token legítimo recém-emitido e a outra sessão também morreram
    await expect(refresh.execute({ refreshToken: rotated.refreshToken })).rejects.toBeInstanceOf(NotAuthenticatedError)
    await expect(refresh.execute({ refreshToken: laptop.refreshToken })).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('dentro da graça é corrida honesta: só recusa, sem derrubar nada e sem evento', async () => {
    const { events, authenticate, refresh } = await setUp({ reuseGraceSeconds: 60 })
    const session = await authenticate()
    const rotated = await refresh.execute({ refreshToken: session.refreshToken })

    await expect(refresh.execute({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(NotAuthenticatedError)

    expect(events).toHaveLength(0)
    expect(await refresh.execute({ refreshToken: rotated.refreshToken })).toBeDefined()
  })

  it('rotações simultâneas do mesmo token: exatamente uma vence', async () => {
    const { authenticate, refresh } = await setUp({ reuseGraceSeconds: 60 })
    const session = await authenticate()

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => refresh.execute({ refreshToken: session.refreshToken })),
    )

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  })

  it('token que nunca existiu é recusa simples, não reuso', async () => {
    const { events, refresh } = await setUp()
    await expect(refresh.execute({ refreshToken: 'nunca-emitido' })).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(events).toHaveLength(0)
  })

  it('usuário desativado não fica com sessão viva: o token recém-rotacionado é revogado', async () => {
    const { dependencies, authenticate, refresh } = await setUp()
    const session = await authenticate()
    await dependencies.users.update({ companyId: undefined, id: session.user.id, values: { isActive: false } })

    await expect(refresh.execute({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(NotAuthenticatedError)

    const store = dependencies.refreshTokenStore as ReturnType<typeof createInMemoryRefreshTokenStore>
    const live = [...store.rows.entries()].filter(([, row]) => row.revokedAt === null)
    expect(live).toHaveLength(0)
    expect(hashToken(session.refreshToken)).toBeTruthy()
  })
})
