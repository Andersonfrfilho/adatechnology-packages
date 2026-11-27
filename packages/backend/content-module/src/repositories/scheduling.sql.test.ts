/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * SQL real das operações de agendamento, capturado num driver de mentira: prova a trava
 * (`FOR UPDATE SKIP LOCKED`), a exclusão de modelo e o escopo por empresa sem precisar de Postgres.
 */

import { describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/pg-proxy'

import { PostRepository } from './PostRepository'
import { RecurrenceRepository } from './RecurrenceRepository'

function capture() {
  const statements: { sql: string; params: unknown[] }[] = []
  const db = drizzle(async (sql, params) => {
    statements.push({ sql, params })
    return { rows: [] }
  })
  return { db, statements }
}

const now = new Date('2026-11-20T12:00:00.000Z')

describe('claimDueScheduled', () => {
  it('um UPDATE só, com a seleção travada e sem modelo', async () => {
    const { db, statements } = capture()
    await new PostRepository(db).claimDueScheduled({ now, limit: 10 })
    expect(statements).toHaveLength(1)
    const text = statements[0]?.sql ?? ''
    expect(text).toContain('update "content"."posts"')
    expect(text).toContain('for update skip locked')
    expect(text).toContain('"is_template" = $')
    expect(text).toContain('"published_at" <= $')
    expect(text).not.toContain('"updated_at" =')
  })
})

describe('contagem por aba', () => {
  it('uma consulta, filtrada por empresa', async () => {
    const { db, statements } = capture()
    await new PostRepository(db).countByStatus({ companyId: 'company-a', now })
    expect(statements).toHaveLength(1)
    expect(statements[0]?.sql).toContain('"company_id" = $')
    expect(statements[0]?.params).toContain('company-a')
  })
})

describe('recorrência', () => {
  it('processDue trava as regras vencidas (SKIP LOCKED) para o ciclo', async () => {
    const { db, statements } = capture()
    // O driver de mentira não tem transação: o `transaction` repassa a própria conexão.
    const withTransaction = { transaction: (run: (tx: typeof db) => Promise<unknown>) => run(db) }
    await new RecurrenceRepository(withTransaction as never).processDue({ now, limit: 5, handle: async () => ({}) })
    const text = statements.map((statement) => statement.sql).join('\n')
    expect(text).toContain('for update skip locked')
    expect(text).toContain('"is_active" = $')
  })

  it('operações do painel escopam por company_id', async () => {
    const { db, statements } = capture()
    const repository = new RecurrenceRepository(db)
    await repository.findById({ companyId: 'company-a', id: 'r1' })
    await repository.list({ companyId: 'company-a' })
    await repository.remove({ companyId: 'company-a', id: 'r1' })
    for (const statement of statements) expect(statement.sql).toContain('"company_id" = $')
  })
})
