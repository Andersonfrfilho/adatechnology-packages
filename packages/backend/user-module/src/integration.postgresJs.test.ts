/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Mesmo repositório de refresh, agora sobre o driver `postgres` (postgres-js): ele não serializa `Date`
 * interpolado em SQL cru (o `bun:sql` serializa), então só aqui o teto absoluto prova que o parâmetro
 * chega tipado. Pulado sem `USER_MODULE_TEST_DATABASE_URL`.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
import { userMigrationsFolder } from './runMigrations'
import { hashToken } from './shared/tokenHash'
import type { UserDatabase } from './database.types'

const DATABASE_URL = process.env['USER_MODULE_TEST_DATABASE_URL']
const describeWithDatabase = DATABASE_URL ? describe : describe.skip
const DAY = 86_400

describeWithDatabase('refresh token sobre postgres-js', () => {
  let client: ReturnType<typeof postgres>
  let db: UserDatabase

  beforeAll(async () => {
    client = postgres(DATABASE_URL as string, { max: 5, onnotice: () => undefined })
    await client.unsafe('drop schema if exists "user" cascade')
    const folder = userMigrationsFolder()
    const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
      entries: readonly { tag: string }[]
    }
    for (const entry of journal.entries) {
      for (const statement of readFileSync(join(folder, `${entry.tag}.sql`), 'utf8').split(
        '--> statement-breakpoint',
      )) {
        await client.unsafe(statement)
      }
    }
    db = drizzle({ client }) as unknown as UserDatabase
  })

  afterAll(async () => {
    await client.end()
  })

  const rotateWith = (store: RefreshTokenRepository, token: string, extra: object = {}) =>
    store.rotate({ tokenHash: hashToken(token), newExpiresInSeconds: 30 * DAY, ...extra })

  async function setup(email: string) {
    const user = await new UserRepository(db, 'pgjs').create({ email, name: email, role: 'agent', passwordHash: 'x' })
    return { user, store: new RefreshTokenRepository(db) }
  }

  it('com teto ligado o refresh rotaciona e limita o token novo ao que resta', async () => {
    const { user, store } = await setup('teto-pgjs@example.com')
    const token = await store.issue({
      userId: user.id,
      expiresInSeconds: 30 * DAY,
      sessionStartedAt: new Date(Date.now() - 4 * DAY * 1000),
    })
    const rotated = await rotateWith(store, token, { absoluteExpiresInSeconds: 10 * DAY })
    if (!rotated || !('token' in rotated)) throw new Error('rotação esperada')
    expect(rotated.expiresInSeconds).toBeGreaterThan(6 * DAY - 5)
    expect(rotated.expiresInSeconds).toBeLessThanOrEqual(6 * DAY)
  })

  it('token além do teto é recusado sem virar reuso e sem derrubar as outras sessões', async () => {
    const { user, store } = await setup('alem-teto-pgjs@example.com')
    const overdue = await store.issue({
      userId: user.id,
      expiresInSeconds: 30 * DAY,
      sessionStartedAt: new Date(Date.now() - 11 * DAY * 1000),
    })
    const sibling = await store.issue({ userId: user.id, expiresInSeconds: 3600 })
    expect(await rotateWith(store, overdue, { absoluteExpiresInSeconds: 10 * DAY })).toBeNull()
    expect(await rotateWith(store, overdue, { absoluteExpiresInSeconds: 10 * DAY, reuseGraceSeconds: 0 })).toBeNull()
    expect(await rotateWith(store, sibling, { absoluteExpiresInSeconds: 10 * DAY })).not.toBeNull()
  })

  it('sem teto continua igual', async () => {
    const { user, store } = await setup('sem-teto-pgjs@example.com')
    const token = await store.issue({ userId: user.id, expiresInSeconds: 30 * DAY })
    expect(await rotateWith(store, token)).toMatchObject({ userId: user.id, expiresInSeconds: 30 * DAY })
  })

  it('deleteExpired do reset de senha apaga só os vencidos', async () => {
    const { user } = await setup('reset-pgjs@example.com')
    const resets = new PasswordResetTokenRepository(db)
    await resets.create({ userId: user.id, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() - 1000) })
    await resets.create({ userId: user.id, tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 60_000) })
    expect(await resets.deleteExpired({ now: new Date() })).toBe(1)
  })

  describe('duas renovações simultâneas com o mesmo cookie (duas abas, StrictMode)', () => {
    it('reuseGraceSeconds: 0 -> a perdedora é lida como reuso e TODAS as sessões do usuário são revogadas', async () => {
      const { user, store } = await setup('corrida-zero@example.com')
      const cookie = await store.issue({ userId: user.id, expiresInSeconds: 30 * DAY })
      const otherDevice = await store.issue({ userId: user.id, expiresInSeconds: 30 * DAY })

      const results = await Promise.all([
        rotateWith(store, cookie, { reuseGraceSeconds: 0 }),
        rotateWith(store, cookie, { reuseGraceSeconds: 0 }),
      ])
      const winners = results.filter((result) => result && 'token' in result)
      const reused = results.filter((result) => result && 'reusedForUserId' in result)
      console.info('[corrida grace=0]', JSON.stringify(results.map((r) => (r && 'token' in r ? 'rotacionou' : r))))
      expect(winners).toHaveLength(1)
      expect(reused).toHaveLength(1)
      // o token novo do vencedor e o de outro aparelho morreram juntos
      const survivors = await client.unsafe(
        'select count(*)::int as total from "user".refresh_tokens where user_id = $1',
        [user.id],
      )
      expect(survivors[0]?.total).toBe(0)
      expect(await rotateWith(store, otherDevice)).toBeNull()
    })

    it('grace padrão (10 s) -> a perdedora só é recusada (null) e nenhuma sessão cai', async () => {
      const { user, store } = await setup('corrida-padrao@example.com')
      const cookie = await store.issue({ userId: user.id, expiresInSeconds: 30 * DAY })
      const otherDevice = await store.issue({ userId: user.id, expiresInSeconds: 30 * DAY })

      const results = await Promise.all([rotateWith(store, cookie), rotateWith(store, cookie)])
      expect(results.filter((result) => result && 'token' in result)).toHaveLength(1)
      expect(results.filter((result) => result === null)).toHaveLength(1)
      expect(await rotateWith(store, otherDevice)).not.toBeNull()
    })
  })
})
