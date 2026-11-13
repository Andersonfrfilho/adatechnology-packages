/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória para a suíte de comportamento. O isolamento multiempresa real (cláusula SQL)
 * é coberto por `repositories/isolation.test.ts`, que renderiza SQL de verdade — aqui o foco é a
 * lógica dos casos de uso (login, reset de senha, refresh) sem Postgres.
 */

import { randomUUID, createHash } from 'node:crypto'

import type { NewPasswordResetTokenRow, NewUserRow, PasswordResetTokenRow, UserRow } from '../schema/schema'

const EPOCH = new Date('2026-08-02T12:00:00.000Z')

/**
 * Leitura devolve **cópia**, não referência da linha guardada — mesmo motivo do
 * `catalog-module`: código de produção compara um snapshot anterior contra o estado atual, e uma
 * referência viva faria os dois mudarem juntos.
 */
function snapshot<TRow>(row: TRow | undefined): TRow | undefined {
  return row ? { ...row } : undefined
}

export function createInMemoryUsers(seed: UserRow[] = []) {
  const rows: UserRow[] = [...seed]

  function matchesScope(row: UserRow, companyId: string | undefined): boolean {
    return companyId === undefined ? row.companyId === null : row.companyId === companyId
  }

  return {
    rows,
    async create(values: NewUserRow): Promise<UserRow> {
      const row = {
        id: randomUUID(),
        passwordHash: null,
        externalId: null,
        isActive: true,
        lastSeenAt: null,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        providerId: 'local',
        ...values,
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
    async findByProviderExternalId(params: { providerId: string; externalId: string }): Promise<UserRow | undefined> {
      return snapshot(
        rows.find(
          (row) => row.providerId === params.providerId && row.externalId === params.externalId && !row.deletedAt,
        ),
      )
    },
    async findByIdUnscoped(params: { id: string }): Promise<UserRow | undefined> {
      return snapshot(rows.find((row) => row.id === params.id && !row.deletedAt))
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
      const row = rows.find((candidate) => candidate.id === params.id && !candidate.deletedAt)
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

export function createInMemoryRefreshTokenStore() {
  const rows = new Map<string, { userId: string; expiresAt: Date }>()

  return {
    rows,
    async issue(params: { userId: string; expiresInSeconds: number }): Promise<string> {
      const rawToken = randomUUID()
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      rows.set(tokenHash, { userId: params.userId, expiresAt: new Date(Date.now() + params.expiresInSeconds * 1000) })
      return rawToken
    },
    /** `Map.delete` antes de reemitir reproduz a semântica atômica do `DELETE ... RETURNING`. */
    async rotate(params: {
      tokenHash: string
      newExpiresInSeconds: number
    }): Promise<{ token: string; userId: string } | null> {
      const existing = rows.get(params.tokenHash)
      if (!existing || existing.expiresAt <= new Date()) return null
      rows.delete(params.tokenHash)

      const token = await this.issue({ userId: existing.userId, expiresInSeconds: params.newExpiresInSeconds })
      return { token, userId: existing.userId }
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
