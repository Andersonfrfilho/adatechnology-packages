/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória para a suíte de comportamento. O isolamento multiempresa real (cláusula SQL)
 * é coberto por `repositories/isolation.test.ts`, que renderiza SQL de verdade — aqui o foco é a
 * lógica dos casos de uso (login, reset de senha, refresh) sem Postgres.
 */

import { randomUUID, createHash } from 'node:crypto'

import { isForgiven, type LockoutPolicy, lockMinutesForLevel } from '@adatechnology/login-lockout'
import type { RefreshRotationResult, RefreshTokenStorePort } from '@adatechnology/user-contracts'

import type {
  AccountChallengeRow,
  NewPasswordResetTokenRow,
  NewUserRow,
  PasswordResetTokenRow,
  UserRow,
} from '../schema/schema'

const EPOCH = new Date('2026-08-02T12:00:00.000Z')

/**
 * Leitura devolve **cópia**, não referência da linha guardada — mesmo motivo do
 * `catalog-module`: código de produção compara um snapshot anterior contra o estado atual, e uma
 * referência viva faria os dois mudarem juntos.
 */
function snapshot<TRow>(row: TRow | undefined): TRow | undefined {
  return row ? { ...row } : undefined
}

/**
 * `audience` reproduz o `UserRepository(db, audience)`: duas instâncias sobre o MESMO `rows`
 * (`createInMemoryUsers(seed, 'customers', sharedRows)`) enxergam populações separadas.
 */
export function createInMemoryUsers(seed: UserRow[] = [], audience = 'default', sharedRows?: UserRow[]) {
  const rows: UserRow[] = sharedRows ?? [...seed]

  function matchesScope(row: UserRow, companyId: string | undefined): boolean {
    const isSameCompany = companyId === undefined ? row.companyId === null : row.companyId === companyId
    return isSameCompany && row.audience === audience
  }

  function findInAudience(id: string): UserRow | undefined {
    return rows.find((row) => row.id === id && row.audience === audience && !row.deletedAt)
  }

  return {
    rows,
    async create(values: NewUserRow): Promise<UserRow> {
      const row = {
        id: randomUUID(),
        passwordHash: null,
        externalId: null,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lockLevel: 0,
        lastFailedLoginAt: null,
        lastSeenAt: null,
        emailVerifiedAt: null,
        phone: null,
        phoneVerifiedAt: null,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        providerId: 'local',
        ...values,
        audience,
        companyId: values.companyId ?? null,
      } as UserRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string | undefined; id: string }): Promise<UserRow | undefined> {
      return snapshot(rows.find((row) => matchesScope(row, params.companyId) && row.id === params.id && !row.deletedAt))
    },
    async findByEmail(params: { companyId: string | undefined; email: string }): Promise<UserRow | undefined> {
      return snapshot(
        rows.find((row) => matchesScope(row, params.companyId) && row.email === params.email && !row.deletedAt),
      )
    },
    async findByPhone(params: { companyId: string | undefined; phone: string }): Promise<UserRow | undefined> {
      return snapshot(
        rows.find((row) => matchesScope(row, params.companyId) && row.phone === params.phone && !row.deletedAt),
      )
    },
    async findByProviderExternalId(params: { providerId: string; externalId: string }): Promise<UserRow | undefined> {
      return snapshot(
        rows.find(
          (row) =>
            row.audience === audience &&
            row.providerId === params.providerId &&
            row.externalId === params.externalId &&
            !row.deletedAt,
        ),
      )
    },
    async findByIdUnscoped(params: { id: string }): Promise<UserRow | undefined> {
      return snapshot(findInAudience(params.id))
    },
    /** Mesma semântica do `UPDATE ... RETURNING` único do repositório real: sem ponto de suspensão no meio. */
    async registerFailedLogin(params: {
      id: string
      now: Date
      maxFailedAttempts: number
      policy: LockoutPolicy
    }): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null; didLock: boolean } | undefined> {
      const row = findInAudience(params.id)
      if (!row || (row.lockedUntil && row.lockedUntil > params.now)) return undefined
      const isExpiredLock = row.lockedUntil !== null && row.lockedUntil <= params.now
      const forgiven =
        row.lastFailedLoginAt !== null &&
        isForgiven({ state: { lastFailureAt: row.lastFailedLoginAt }, now: params.now, policy: params.policy })
      const level = forgiven ? 0 : row.lockLevel
      row.failedLoginAttempts = isExpiredLock || forgiven ? 1 : row.failedLoginAttempts + 1
      const didLock = row.failedLoginAttempts >= params.maxFailedAttempts
      row.lockedUntil = didLock
        ? new Date(params.now.getTime() + lockMinutesForLevel({ policy: params.policy, level }) * 60_000)
        : null
      row.lockLevel = didLock ? level + 1 : level
      row.lastFailedLoginAt = params.now
      return { failedLoginAttempts: row.failedLoginAttempts, lockedUntil: row.lockedUntil, didLock }
    },
    async registerSuccessfulLogin(params: { id: string; now: Date }): Promise<UserRow | undefined> {
      const row = findInAudience(params.id)
      if (!row || (row.lockedUntil && row.lockedUntil > params.now)) return undefined
      Object.assign(row, {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lockLevel: 0,
        lastFailedLoginAt: null,
        lastSeenAt: params.now,
      })
      return snapshot(row)
    },
    async update(params: {
      companyId: string | undefined
      id: string
      values: Partial<NewUserRow>
    }): Promise<UserRow | undefined> {
      const row = rows.find(
        (candidate) => matchesScope(candidate, params.companyId) && candidate.id === params.id && !candidate.deletedAt,
      )
      if (!row) return undefined
      Object.assign(row, params.values, { updatedAt: EPOCH })
      return snapshot(row)
    },
    async updateById(params: { id: string; values: Partial<NewUserRow> }): Promise<UserRow | undefined> {
      const row = findInAudience(params.id)
      if (!row) return undefined
      Object.assign(row, params.values, { updatedAt: EPOCH })
      return snapshot(row)
    },
    async list(query: { companyId: string | undefined; page: number; pageSize: number }) {
      const filtered = rows.filter((row) => matchesScope(row, query.companyId) && !row.deletedAt)
      return {
        rows: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((row) => ({ ...row })),
        total: filtered.length,
      }
    },
  }
}

export function createInMemoryPasswordResetTokens(seed: PasswordResetTokenRow[] = []) {
  const rows: PasswordResetTokenRow[] = [...seed]

  return {
    rows,
    async create(values: NewPasswordResetTokenRow): Promise<PasswordResetTokenRow> {
      const row = {
        id: randomUUID(),
        consumedAt: null,
        requestedIp: null,
        createdAt: EPOCH,
        ...values,
      } as PasswordResetTokenRow
      rows.push(row)
      return row
    },
    /**
     * Reproduz o `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING` sem
     * ponto de suspensão entre checar e gravar — é o que torna o teste de concorrência honesto.
     */
    async confirmAndConsume(params: { tokenHash: string; now: Date }): Promise<{ userId: string } | undefined> {
      const row = rows.find(
        (candidate) =>
          candidate.tokenHash === params.tokenHash && !candidate.consumedAt && candidate.expiresAt > params.now,
      )
      if (!row) return undefined
      row.consumedAt = params.now
      return { userId: row.userId }
    },
    async findByHash(params: { tokenHash: string }): Promise<PasswordResetTokenRow | undefined> {
      return snapshot(rows.find((row) => row.tokenHash === params.tokenHash))
    },
    async deleteExpired(params: { now: Date }): Promise<number> {
      const before = rows.length
      const remaining = rows.filter((row) => row.expiresAt >= params.now)
      rows.length = 0
      rows.push(...remaining)
      return before - remaining.length
    },
  }
}

export function createInMemoryAccountChallenges() {
  const rows: AccountChallengeRow[] = []
  let sequence = 0

  return {
    rows,
    async issue(params: {
      userId: string
      kind: string
      secretHash: string
      target: string
      expiresAt: Date
      now: Date
    }): Promise<AccountChallengeRow> {
      for (const row of rows) {
        if (row.userId === params.userId && row.kind === params.kind && !row.consumedAt) row.consumedAt = params.now
      }
      sequence += 1
      const row: AccountChallengeRow = {
        id: randomUUID(),
        userId: params.userId,
        kind: params.kind,
        secretHash: params.secretHash,
        target: params.target,
        attempts: 0,
        expiresAt: params.expiresAt,
        consumedAt: null,
        // O relógio do teste pode não andar: a sequência desempata o "mais recente".
        createdAt: new Date(params.now.getTime() + sequence),
      }
      rows.push(row)
      return { ...row }
    },
    async consumeBySecret(params: { kind: string; secretHash: string; now: Date }) {
      const row = rows.find(
        (candidate) =>
          candidate.kind === params.kind &&
          candidate.secretHash === params.secretHash &&
          !candidate.consumedAt &&
          candidate.expiresAt > params.now,
      )
      if (!row) return undefined
      row.consumedAt = params.now
      return { userId: row.userId, target: row.target }
    },
    async findLatest(params: { userId: string; kind: string }): Promise<AccountChallengeRow | undefined> {
      const own = rows.filter((row) => row.userId === params.userId && row.kind === params.kind)
      return snapshot(own.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0])
    },
    async registerAttempt(params: { id: string }): Promise<number | undefined> {
      const row = rows.find((candidate) => candidate.id === params.id && !candidate.consumedAt)
      if (!row) return undefined
      row.attempts += 1
      return row.attempts
    },
    async consume(params: { id: string; now: Date }): Promise<boolean> {
      const row = rows.find((candidate) => candidate.id === params.id && !candidate.consumedAt)
      if (!row) return false
      row.consumedAt = params.now
      return true
    },
  }
}

export function createInMemoryRefreshTokenStore(options: { readonly now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date())
  const rows = new Map<
    string,
    { userId: string; expiresAt: Date; revokedAt: Date | null; rememberMe: boolean | null; sessionStartedAt: Date }
  >()

  return {
    rows,
    async issue(params: {
      userId: string
      expiresInSeconds: number
      rememberMe?: boolean
      sessionStartedAt?: Date
    }): Promise<string> {
      const rawToken = randomUUID()
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      rows.set(tokenHash, {
        userId: params.userId,
        expiresAt: new Date(now().getTime() + params.expiresInSeconds * 1000),
        revokedAt: null,
        rememberMe: params.rememberMe ?? null,
        sessionStartedAt: params.sessionStartedAt ?? now(),
      })
      return rawToken
    },
    /** Marca `revokedAt` sem ponto de suspensão entre checar e gravar — o `UPDATE ... RETURNING` do real. */
    async rotate(params: Parameters<RefreshTokenStorePort['rotate']>[0]): Promise<RefreshRotationResult> {
      const current = now()
      const existing = rows.get(params.tokenHash)
      if (!existing || existing.expiresAt <= current) return null

      if (existing.revokedAt) {
        const graceMs = (params.reuseGraceSeconds ?? 10) * 1000
        if (current.getTime() - existing.revokedAt.getTime() < graceMs) return null
        await this.revokeAllForUser({ userId: existing.userId })
        return { reusedForUserId: existing.userId }
      }

      const absolute = params.absoluteExpiresInSeconds
      const elapsedSeconds = (current.getTime() - existing.sessionStartedAt.getTime()) / 1000
      if (absolute !== undefined && elapsedSeconds >= absolute) return null

      existing.revokedAt = current
      const rememberMe = existing.rememberMe ?? params.rememberMeHint
      const byChoice = params.expiresInSecondsByChoice
      const lifetimeSeconds =
        rememberMe === undefined || !byChoice
          ? params.newExpiresInSeconds
          : rememberMe
            ? byChoice.remember
            : byChoice.session
      const remainingSeconds = absolute === undefined ? Number.POSITIVE_INFINITY : absolute - elapsedSeconds
      const expiresInSeconds = Math.max(1, Math.floor(Math.min(lifetimeSeconds, remainingSeconds)))
      const token = await this.issue({
        userId: existing.userId,
        expiresInSeconds,
        ...(rememberMe === undefined ? {} : { rememberMe }),
        sessionStartedAt: existing.sessionStartedAt,
      })
      return { token, userId: existing.userId, ...(rememberMe === undefined ? {} : { rememberMe }), expiresInSeconds }
    },
    async revoke(params: { tokenHash: string }): Promise<void> {
      rows.delete(params.tokenHash)
    },
    async revokeAllForUser(params: { userId: string }): Promise<void> {
      for (const [tokenHash, row] of rows) {
        if (row.userId === params.userId) rows.delete(tokenHash)
      }
    },
  }
}
