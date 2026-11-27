/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, lte } from 'drizzle-orm'

import type { ContentDatabase } from '../database.types'
import { recurrenceRules, type NewRecurrenceRow, type RecurrenceRow } from '../schema/schema'
import type { RecurrenceStorePort } from '../use-cases/contentModule.types'

export function recurrenceOwnedByCondition(params: { companyId: string; id: string }) {
  return and(eq(recurrenceRules.companyId, params.companyId), eq(recurrenceRules.id, params.id))
}

export class RecurrenceRepository implements RecurrenceStorePort {
  constructor(private readonly db: ContentDatabase) {}

  async create(values: NewRecurrenceRow): Promise<RecurrenceRow> {
    const [row] = await this.db.insert(recurrenceRules).values(values).returning()
    if (!row) throw new Error('content-module: insert em recurrence_rules não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<RecurrenceRow | undefined> {
    const [row] = await this.db.select().from(recurrenceRules).where(recurrenceOwnedByCondition(params)).limit(1)
    return row
  }

  async list(params: { companyId: string }): Promise<readonly RecurrenceRow[]> {
    return this.db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.companyId, params.companyId))
      .orderBy(asc(recurrenceRules.nextRunAt), asc(recurrenceRules.id))
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewRecurrenceRow>
  }): Promise<RecurrenceRow | undefined> {
    const [row] = await this.db
      .update(recurrenceRules)
      .set(params.values)
      .where(recurrenceOwnedByCondition(params))
      .returning()
    return row
  }

  async remove(params: { companyId: string; id: string }): Promise<boolean> {
    const removed = await this.db
      .delete(recurrenceRules)
      .where(recurrenceOwnedByCondition(params))
      .returning({ id: recurrenceRules.id })
    return removed.length > 0
  }

  async processDue(params: {
    now: Date
    limit: number
    handle: (rule: RecurrenceRow) => Promise<Partial<NewRecurrenceRow>>
  }): Promise<number> {
    return this.db.transaction(async (transaction) => {
      const due = await transaction
        .select()
        .from(recurrenceRules)
        .where(and(eq(recurrenceRules.isActive, true), lte(recurrenceRules.nextRunAt, params.now)))
        .orderBy(asc(recurrenceRules.nextRunAt), asc(recurrenceRules.id))
        .limit(params.limit)
        .for('update', { skipLocked: true })
      let processed = 0
      // Sequencial de propósito: a transação é uma conexão só, e a ordem é a da data de vencimento.
      for (const rule of due) {
        const values = await params.handle(rule)
        await transaction.update(recurrenceRules).set(values).where(eq(recurrenceRules.id, rule.id))
        processed += 1
      }
      return processed
    })
  }
}
