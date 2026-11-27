/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Contra um Postgres de verdade — é o único lugar onde "atômico num único UPDATE" é provado, não
 * suposto. Pulado sem `USER_MODULE_TEST_DATABASE_URL` (ex: `postgres://postgres:test@localhost:5432/test`).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SQL } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sql'

import { resolveLockoutPolicy } from '@adatechnology/login-lockout'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
import { userMigrationsFolder } from './runMigrations'
import { hashToken } from './shared/tokenHash'
import type { UserDatabase } from './database.types'

const policyOf = (overrides: Parameters<typeof resolveLockoutPolicy>[0]) => resolveLockoutPolicy(overrides)
const DATABASE_URL = process.env['USER_MODULE_TEST_DATABASE_URL']
/**
 * Aplica o `.sql` publicado na ordem do journal, sem o migrator do drizzle-orm: o do 1.x recusa o
 * formato clássico que o host (migrator 0.x) lê, e o que se testa aqui é o SQL, não o migrator.
 */
async function applyMigrations(sql: SQL, params: { readonly upTo?: number } = {}): Promise<void> {
  const folder = userMigrationsFolder()
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: readonly { idx: number; tag: string }[]
  }
  for (const entry of journal.entries.filter((candidate) => candidate.idx <= (params.upTo ?? Infinity))) {
    for (const statement of readFileSync(join(folder, `${entry.tag}.sql`), 'utf8').split('--> statement-breakpoint')) {
      await sql.unsafe(statement)
    }
  }
}

async function resetSchema(sql: SQL): Promise<void> {
  await sql.unsafe('drop schema if exists "user" cascade')
}

const describeWithDatabase = DATABASE_URL ? describe : describe.skip

describeWithDatabase('migração aditiva sobre dados existentes', () => {
  it('linhas anteriores à audiência ficam válidas em `default` e o índice único as respeita', async () => {
    const sql = new SQL(DATABASE_URL as string)
    await resetSchema(sql)
    await applyMigrations(sql, { upTo: 1 })
    await sql.unsafe(`insert into "user".users (email, name, role) values ('legado@example.com', 'Legado', 'agent')`)

    const journal = JSON.parse(readFileSync(join(userMigrationsFolder(), 'meta', '_journal.json'), 'utf8')) as {
      entries: readonly { tag: string }[]
    }
    const upgrade = readFileSync(join(userMigrationsFolder(), `${journal.entries[2]?.tag}.sql`), 'utf8')
    for (const statement of upgrade.split('--> statement-breakpoint')) await sql.unsafe(statement)

    const [row] = await sql.unsafe(`select audience, failed_login_attempts, locked_until from "user".users`)
    expect(row.audience).toBe('default')
    expect(row.failed_login_attempts).toBe(0)
    expect(row.locked_until).toBeNull()

    // `sql.unsafe` devolve um thenable lazy: `await` dentro de uma async fn o torna uma Promise de verdade.
    const insertDuplicate = async (): Promise<unknown> =>
      await sql.unsafe(`insert into "user".users (email, name, role) values ('legado@example.com', 'Outro', 'agent')`)
    await expect(insertDuplicate()).rejects.toThrow()
    await sql.unsafe(
      `insert into "user".users (email, name, role, audience) values ('legado@example.com', 'Cliente', 'guest', 'customers')`,
    )
    await sql.close()
  })
})

describeWithDatabase('repositórios sobre Postgres', () => {
  let sql: SQL
  let db: UserDatabase

  beforeAll(async () => {
    sql = new SQL(DATABASE_URL as string)
    await resetSchema(sql)
    await applyMigrations(sql)
    db = drizzle({ client: sql }) as unknown as UserDatabase
  })

  afterAll(async () => {
    await sql.close()
  })

  async function createUser(users: UserRepository, email: string) {
    return users.create({ email, name: email, role: 'agent', passwordHash: 'x' })
  }

  it('o mesmo e-mail existe em audiências diferentes, mas não duas vezes na mesma', async () => {
    const staff = new UserRepository(db, 'staff')
    const customers = new UserRepository(db, 'customers')

    const staffUser = await createUser(staff, 'dupla@example.com')
    const customerUser = await createUser(customers, 'dupla@example.com')

    await expect(createUser(staff, 'dupla@example.com')).rejects.toThrow()
    expect(await staff.findByEmail({ companyId: undefined, email: 'dupla@example.com' })).toMatchObject({
      id: staffUser.id,
    })
    expect(await staff.findById({ companyId: undefined, id: customerUser.id })).toBeUndefined()
    expect(await staff.findByIdUnscoped({ id: customerUser.id })).toBeUndefined()
  })

  it('tentativas falhas simultâneas somam todas e só uma cruza o limite', async () => {
    const users = new UserRepository(db, 'lockout-race')
    const user = await createUser(users, 'corrida@example.com')
    const now = new Date()

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        users.registerFailedLogin({
          id: user.id,
          now,
          maxFailedAttempts: 5,
          policy: policyOf({ maxFailedAttempts: 5, baseLockMinutes: 15 }),
        }),
      ),
    )

    const counted = results.filter((result) => result !== undefined)
    expect(counted).toHaveLength(5)
    expect(counted.filter((result) => result?.didLock)).toHaveLength(1)

    const stored = await users.findById({ companyId: undefined, id: user.id })
    expect(stored?.failedLoginAttempts).toBe(5)
    expect(stored?.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60_000)
  })

  it('bloqueio progressivo no SQL: 15, 30, teto, e perdão depois de um dia', async () => {
    const users = new UserRepository(db, 'lockout-progressive')
    const user = await createUser(users, 'progressivo@example.com')
    const policy = policyOf({
      maxFailedAttempts: 1,
      baseLockMinutes: 15,
      multiplier: 2,
      maxLockMinutes: 40,
      forgiveAfterMinutes: 1440,
    })
    let now = new Date('2026-09-01T12:00:00.000Z')
    const durations: number[] = []

    for (let round = 0; round < 3; round += 1) {
      const failure = await users.registerFailedLogin({ id: user.id, now, maxFailedAttempts: 1, policy })
      const minutes = ((failure?.lockedUntil?.getTime() ?? 0) - now.getTime()) / 60_000
      durations.push(minutes)
      now = new Date(now.getTime() + minutes * 60_000 + 1000)
    }
    now = new Date(now.getTime() + 25 * 60 * 60_000)
    const forgiven = await users.registerFailedLogin({ id: user.id, now, maxFailedAttempts: 1, policy })
    durations.push(((forgiven?.lockedUntil?.getTime() ?? 0) - now.getTime()) / 60_000)

    expect(durations).toEqual([15, 30, 40, 15])
    expect(
      await users.registerSuccessfulLogin({ id: user.id, now: new Date(now.getTime() + 16 * 60_000) }),
    ).toBeDefined()
    expect((await users.findById({ companyId: undefined, id: user.id }))?.lockLevel).toBe(0)
  })

  it('conta bloqueada recusa o sucesso e, vencido o prazo, o contador recomeça', async () => {
    const users = new UserRepository(db, 'lockout-expiry')
    const user = await createUser(users, 'prazo@example.com')
    const now = new Date()
    await users.registerFailedLogin({
      id: user.id,
      now,
      maxFailedAttempts: 1,
      policy: policyOf({ maxFailedAttempts: 1, baseLockMinutes: 10 }),
    })

    expect(await users.registerSuccessfulLogin({ id: user.id, now })).toBeUndefined()

    const later = new Date(now.getTime() + 11 * 60_000)
    const failure = await users.registerFailedLogin({
      id: user.id,
      now: later,
      maxFailedAttempts: 3,
      policy: policyOf({ maxFailedAttempts: 3, baseLockMinutes: 10 }),
    })
    expect(failure).toMatchObject({ failedLoginAttempts: 1, lockedUntil: null, didLock: false })
    expect(await users.registerSuccessfulLogin({ id: user.id, now: later })).toBeDefined()
    expect((await users.findById({ companyId: undefined, id: user.id }))?.failedLoginAttempts).toBe(0)
  })

  it('rotação simultânea do mesmo refresh token tem um único vencedor', async () => {
    const users = new UserRepository(db, 'refresh-race')
    const user = await createUser(users, 'refresh@example.com')
    const store = new RefreshTokenRepository(db)
    const token = await store.issue({ userId: user.id, expiresInSeconds: 3600 })

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.rotate({ tokenHash: hashToken(token), newExpiresInSeconds: 3600, reuseGraceSeconds: 60 }),
      ),
    )

    expect(results.filter((result) => result && 'token' in result)).toHaveLength(1)
    expect(results.filter((result) => result === null)).toHaveLength(9)
  })

  it('reapresentar token já rotacionado, fora da graça, revoga todas as sessões do usuário', async () => {
    const users = new UserRepository(db, 'refresh-reuse')
    const user = await createUser(users, 'reuso@example.com')
    const store = new RefreshTokenRepository(db)
    const original = await store.issue({ userId: user.id, expiresInSeconds: 3600 })
    const otherSession = await store.issue({ userId: user.id, expiresInSeconds: 3600 })

    const rotated = await store.rotate({ tokenHash: hashToken(original), newExpiresInSeconds: 3600 })
    expect(rotated && 'token' in rotated).toBe(true)

    const replay = await store.rotate({
      tokenHash: hashToken(original),
      newExpiresInSeconds: 3600,
      reuseGraceSeconds: 0,
    })
    expect(replay).toEqual({ reusedForUserId: user.id })

    expect(await store.rotate({ tokenHash: hashToken(otherSession), newExpiresInSeconds: 3600 })).toBeNull()
    if (rotated && 'token' in rotated) {
      expect(await store.rotate({ tokenHash: hashToken(rotated.token), newExpiresInSeconds: 3600 })).toBeNull()
    }
  })

  it('logout apaga a linha: reapresentar o cookie é recusa simples, não reuso', async () => {
    const users = new UserRepository(db, 'refresh-logout')
    const user = await createUser(users, 'logout@example.com')
    const store = new RefreshTokenRepository(db)
    const token = await store.issue({ userId: user.id, expiresInSeconds: 3600 })
    const sibling = await store.issue({ userId: user.id, expiresInSeconds: 3600 })

    await store.revoke({ tokenHash: hashToken(token) })

    expect(
      await store.rotate({ tokenHash: hashToken(token), newExpiresInSeconds: 3600, reuseGraceSeconds: 0 }),
    ).toBeNull()
    expect(await store.rotate({ tokenHash: hashToken(sibling), newExpiresInSeconds: 3600 })).not.toBeNull()
  })

  const LIFETIMES = { remember: 90 * 86_400, session: 7200 }
  const rotateWith = (store: RefreshTokenRepository, token: string, extra: Record<string, unknown> = {}) =>
    store.rotate({
      tokenHash: hashToken(token),
      newExpiresInSeconds: 30 * 86_400,
      expiresInSecondsByChoice: LIFETIMES,
      ...extra,
    })

  it('o lembrar de mim fica gravado no token e a rotação o herda, ignorando a dica do cookie', async () => {
    const users = new UserRepository(db, 'refresh-remember')
    const user = await createUser(users, 'lembrar@example.com')
    const store = new RefreshTokenRepository(db)

    const remembered = await store.issue({ userId: user.id, expiresInSeconds: 3600, rememberMe: true })
    const first = await rotateWith(store, remembered, { rememberMeHint: false })
    expect(first).toMatchObject({ rememberMe: true, expiresInSeconds: LIFETIMES.remember })

    const sessionOnly = await store.issue({ userId: user.id, expiresInSeconds: 3600, rememberMe: false })
    expect(await rotateWith(store, sessionOnly, { rememberMeHint: true })).toMatchObject({
      rememberMe: false,
      expiresInSeconds: LIFETIMES.session,
    })
  })

  it('token anterior ao registro (remember_me nulo) usa a dica uma vez e a grava no token novo', async () => {
    const users = new UserRepository(db, 'refresh-legacy')
    const user = await createUser(users, 'legado-refresh@example.com')
    const store = new RefreshTokenRepository(db)

    const legacy = await store.issue({ userId: user.id, expiresInSeconds: 3600 })
    const migrated = await rotateWith(store, legacy, { rememberMeHint: true })
    expect(migrated).toMatchObject({ rememberMe: true, expiresInSeconds: LIFETIMES.remember })
    if (!migrated || !('token' in migrated)) throw new Error('rotação esperada')

    expect(await rotateWith(store, migrated.token)).toMatchObject({ rememberMe: true })
    const untouched = await store.issue({ userId: user.id, expiresInSeconds: 3600 })
    const plain = await rotateWith(store, untouched)
    expect(plain).toMatchObject({ expiresInSeconds: 30 * 86_400 })
    expect(plain && 'rememberMe' in plain).toBe(false)
  })

  it('o teto absoluto conta do login, limita o token novo e recusa depois dele sem marcar reuso', async () => {
    const users = new UserRepository(db, 'refresh-cap')
    const user = await createUser(users, 'teto@example.com')
    const store = new RefreshTokenRepository(db)
    const cap = 10 * 86_400

    const started = new Date(Date.now() - 4 * 86_400 * 1000)
    const token = await store.issue({
      userId: user.id,
      expiresInSeconds: 86_400 * 30,
      rememberMe: true,
      sessionStartedAt: started,
    })
    const rotated = await rotateWith(store, token, { absoluteExpiresInSeconds: cap })
    if (!rotated || !('token' in rotated)) throw new Error('rotação esperada')
    // Restam ~6 dias dos 10: o token novo não vive os 90 pedidos pela escolha.
    expect(rotated.expiresInSeconds).toBeGreaterThan(6 * 86_400 - 5)
    expect(rotated.expiresInSeconds).toBeLessThanOrEqual(6 * 86_400)

    const overdue = await store.issue({
      userId: user.id,
      expiresInSeconds: 86_400 * 30,
      rememberMe: true,
      sessionStartedAt: new Date(Date.now() - 11 * 86_400 * 1000),
    })
    const sibling = await store.issue({ userId: user.id, expiresInSeconds: 3600, rememberMe: true })
    expect(await rotateWith(store, overdue, { absoluteExpiresInSeconds: cap })).toBeNull()
    expect(await rotateWith(store, overdue, { absoluteExpiresInSeconds: cap, reuseGraceSeconds: 0 })).toBeNull()
    expect(await rotateWith(store, sibling, { absoluteExpiresInSeconds: cap })).not.toBeNull()
  })
})
