/**
 * Integração real contra Postgres: origem do grafo (`seed`/`edited`) e reseed do produto.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada (mesmo padrão das demais
 * integrações do pacote).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import type { FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'

import type { MetaWhatsAppDatabase } from '../database.types'
import { flowGraphs } from '../schema/schema'
import { runMetaWhatsAppMigrations } from '../runMigrations'
import { FlowGraphRepository } from './FlowGraphRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

function nodesWith(message: string): Record<string, FlowNodeData> {
  return { start: { id: 'start', type: 'action', directMessage: message } }
}

describeWithDatabase('FlowGraphRepository — origem e reseed (integração Postgres real)', () => {
  let sql: SQL
  let db: MetaWhatsAppDatabase
  let repository: FlowGraphRepository
  const companyId = crypto.randomUUID()

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle({ client: sql }) as unknown as MetaWhatsAppDatabase
    await runMetaWhatsAppMigrations({
      db,
      migrate: async (target, config) => {
        await migrate(target as never, config)
      },
    })
    repository = new FlowGraphRepository(db)
  })

  afterAll(async () => {
    await db.delete(flowGraphs).where(eq(flowGraphs.companyId, companyId))
    await sql.end()
  })

  const base = (key: string, message: string) => ({
    key,
    label: key,
    startNodeId: 'start',
    nodes: nodesWith(message),
  })

  test('grafo criado com seedVersion nasce como seed; sem, como edited', async () => {
    const seeded = await repository.create(companyId, { ...base('seeded', 'v1'), seedVersion: '1' })
    const manual = await repository.create(companyId, base('manual', 'v1'))
    expect(seeded).toMatchObject({ origin: 'seed', seedVersion: '1' })
    expect(manual.origin).toBe('edited')
    expect(manual.seedVersion).toBeUndefined()
  })

  test('reseed troca o conteúdo de seed antigo e sobe a versão', async () => {
    await repository.create(companyId, { ...base('swap', 'v1'), seedVersion: '1' })
    const result = await repository.reseed({ companyId, key: 'swap', seedVersion: '2', content: base('swap', 'v2') })
    expect(result.status).toBe('updated')
    const graph = await repository.get(companyId, 'swap')
    expect(graph).toMatchObject({ origin: 'seed', seedVersion: '2', version: 2 })
    expect(graph?.nodes.start?.directMessage).toBe('v2')
  })

  test('reseed é idempotente na mesma versão do seed', async () => {
    await repository.create(companyId, { ...base('same', 'v1'), seedVersion: '1' })
    const result = await repository.reseed({ companyId, key: 'same', seedVersion: '1', content: base('same', 'v9') })
    expect(result.status).toBe('current')
    expect((await repository.get(companyId, 'same'))?.nodes.start?.directMessage).toBe('v1')
  })

  test('salvar pelo editor vira edited, e o reseed não toca nele (mesmo se o payload disser seed)', async () => {
    const created = await repository.create(companyId, { ...base('human', 'v1'), seedVersion: '1' })
    await repository.save(companyId, { ...created, origin: 'seed', nodes: nodesWith('editado') }, created.version)

    const result = await repository.reseed({ companyId, key: 'human', seedVersion: '2', content: base('human', 'v2') })
    expect(result.status).toBe('edited')
    const graph = await repository.get(companyId, 'human')
    expect(graph).toMatchObject({ origin: 'edited', seedVersion: '1' })
    expect(graph?.nodes.start?.directMessage).toBe('editado')
  })

  test('grafo anterior ao campo (default) conta como edited', async () => {
    await db
      .insert(flowGraphs)
      .values({ companyId, key: 'legacy', label: 'legacy', startNodeId: 'start', nodes: nodesWith('v1') })
    const result = await repository.reseed({
      companyId,
      key: 'legacy',
      seedVersion: '1',
      content: base('legacy', 'v2'),
    })
    expect(result.status).toBe('edited')
  })

  test('reseed de grafo inexistente devolve missing', async () => {
    const result = await repository.reseed({ companyId, key: 'nope', seedVersion: '1', content: base('nope', 'v1') })
    expect(result.status).toBe('missing')
  })

  test('list expõe origin e seedVersion', async () => {
    const summaries = await repository.list(companyId)
    expect(summaries.find((summary) => summary.key === 'seeded')).toMatchObject({ origin: 'seed', seedVersion: '1' })
  })
})
