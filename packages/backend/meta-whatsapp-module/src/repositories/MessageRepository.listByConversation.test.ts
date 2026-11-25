import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'

import type { MetaWhatsAppDatabase } from '../database.types'
import type { MessageRow } from '../schema/schema'
import { MessageRepository } from './MessageRepository'

type Captured = { whereSql: string; orderSql: string; limit: number }

const dialect = new PgDialect()

function render(chunk: unknown): string {
  return dialect.sqlToQuery(chunk as never).sql
}

/** Banco falso: devolve as linhas já na ordem em que o SQL capturado pede (DESC), como o Postgres faria. */
function createRepository(rowsNewestFirst: MessageRow[]): { repository: MessageRepository; captured: Captured } {
  const captured: Captured = { whereSql: '', orderSql: '', limit: -1 }
  const chain = {
    from: () => chain,
    where: (condition: unknown) => {
      captured.whereSql = render(condition)
      return chain
    },
    orderBy: (...orders: unknown[]) => {
      captured.orderSql = orders.map(render).join(', ')
      return chain
    },
    limit: (value: number) => {
      captured.limit = value
      return Promise.resolve(rowsNewestFirst.slice(0, value))
    },
  }
  const db = { select: () => chain } as unknown as MetaWhatsAppDatabase
  return { repository: new MessageRepository(db), captured }
}

function row(index: number): MessageRow {
  return { id: `id-${index}`, content: `m${index}` } as unknown as MessageRow
}

describe('MessageRepository.listByConversation', () => {
  const newestFirst = [5, 4, 3, 2, 1].map(row)

  it('asks the database for the newest rows first, so limit keeps the latest messages', async () => {
    const { repository, captured } = createRepository(newestFirst)
    await repository.listByConversation({ companyId: 'c', sessionId: 's', limit: 2 })
    expect(captured.orderSql).toContain('desc')
    expect(captured.limit).toBe(2)
  })

  it('returns the newest page in chronological order', async () => {
    const { repository } = createRepository(newestFirst)
    const page = await repository.listByConversation({ companyId: 'c', sessionId: 's', limit: 3 })
    expect(page.map((message) => message.content)).toEqual(['m3', 'm4', 'm5'])
  })

  it('filters by the cursor when before is given', async () => {
    const { repository, captured } = createRepository(newestFirst.slice(2))
    const page = await repository.listByConversation({
      companyId: 'c',
      sessionId: 's',
      limit: 2,
      before: '2026-01-01T00:00:00.000Z',
    })
    expect(captured.whereSql).toContain('"created_at" <')
    expect(page.map((message) => message.content)).toEqual(['m2', 'm3'])
  })

  it('has no cursor filter without before and defaults the limit', async () => {
    const { repository, captured } = createRepository(newestFirst)
    await repository.listByConversation({ companyId: 'c', sessionId: 's' })
    expect(captured.whereSql).not.toContain('"created_at" <')
    expect(captured.limit).toBe(50)
  })
})
