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

import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
import { userMigrationsFolder } from './runMigrations'
import { hashToken } from './shared/tokenHash'
import type { UserDatabase } from './database.types'

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
        users.registerFailedLogin({ id: user.id, now, maxFailedAttempts: 5, lockMinutes: 15 }),
      ),
    )

    const counted = results.filter((result) => result !== undefined)
    expect(counted).toHaveLength(5)
    expect(counted.filter((result) => result?.didLock)).toHaveLength(1)

    const stored = await users.findById({ companyId: undefined, id: user.id })
    expect(stored?.failedLoginAttempts).toBe(5)
    expect(stored?.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60_000)
  })

  it('conta bloqueada recusa o sucesso e, vencido o prazo, o contador recomeça', async () => {
    const users = new UserRepository(db, 'lockout-expiry')
    const user = await createUser(users, 'prazo@example.com')
    const now = new Date()
    await users.registerFailedLogin({ id: user.id, now, maxFailedAttempts: 1, lockMinutes: 10 })

    expect(await users.registerSuccessfulLogin({ id: user.id, now })).toBeUndefined()

    const later = new Date(now.getTime() + 11 * 60_000)
    const failure = await users.registerFailedLogin({ id: user.id, now: later, maxFailedAttempts: 3, lockMinutes: 10 })
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
})
