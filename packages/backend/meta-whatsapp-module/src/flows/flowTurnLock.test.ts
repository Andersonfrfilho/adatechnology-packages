/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import { InProcessFlowTurnLock, PostgresAdvisoryFlowTurnLock } from './flowTurnLock'

describe('PostgresAdvisoryFlowTurnLock', () => {
  it('takes a transaction-scoped advisory lock keyed by company and number before the work', async () => {
    const steps: string[] = []
    const db = {
      transaction: async (work: (transaction: { execute: (query: SQL) => Promise<void> }) => Promise<unknown>) => {
        steps.push('begin')
        const result = await work({
          execute: async (query) => {
            const compiled = new PgDialect().sqlToQuery(query)
            steps.push(`${compiled.sql} ${JSON.stringify(compiled.params)}`)
          },
        })
        steps.push('commit')
        return result
      },
    } as unknown as MetaWhatsAppDatabase

    const result = await new PostgresAdvisoryFlowTurnLock(db).withLock(
      { companyId: 'c1', whatsappNumber: '551' },
      async () => {
        steps.push('work')
        return 42
      },
    )

    expect(result).toBe(42)
    expect(steps).toEqual([
      'begin',
      'select pg_advisory_xact_lock(hashtext($1)) ["meta_whatsapp_flow:c1:551"]',
      'work',
      'commit',
    ])
  })
})

describe('InProcessFlowTurnLock', () => {
  it('runs work for the same conversation one at a time, even after a failure', async () => {
    const lock = new InProcessFlowTurnLock()
    const key = { companyId: 'c1', whatsappNumber: '551' }
    const order: string[] = []
    const slow = lock.withLock(key, async () => {
      order.push('first-start')
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push('first-end')
      throw new Error('boom')
    })
    const fast = lock.withLock(key, async () => void order.push('second'))
    await expect(slow).rejects.toThrow('boom')
    await fast
    expect(order).toEqual(['first-start', 'first-end', 'second'])
  })
})
