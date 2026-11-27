/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê em memória do `RecurrenceStorePort`: mesmas regras, sem transação (o teste é de um processo só).
 */

import { randomUUID } from 'node:crypto'

import type { NewRecurrenceRow, RecurrenceRow } from '../schema/schema'
import type { RecurrenceStorePort } from '../use-cases/contentModule.types'

export function createInMemoryRecurrenceStore(): RecurrenceStorePort & { readonly rows: RecurrenceRow[] } {
  const rows: RecurrenceRow[] = []
  const owned = (companyId: string, id: string) => rows.find((row) => row.companyId === companyId && row.id === id)

  return {
    rows,
    async create(values: NewRecurrenceRow) {
      const row = {
        id: randomUUID(),
        isActive: true,
        lastRunAt: null,
        lastPostId: null,
        createdAt: new Date(),
        ...values,
      } as RecurrenceRow
      rows.push(row)
      return { ...row }
    },
    async findById({ companyId, id }) {
      const row = owned(companyId, id)
      return row ? { ...row } : undefined
    },
    async list({ companyId }) {
      return rows
        .filter((row) => row.companyId === companyId)
        .sort((left, right) => left.nextRunAt.getTime() - right.nextRunAt.getTime())
        .map((row) => ({ ...row }))
    },
    async update({ companyId, id, values }) {
      const row = owned(companyId, id)
      if (!row) return undefined
      Object.assign(row, values)
      return { ...row }
    },
    async remove({ companyId, id }) {
      const index = rows.findIndex((row) => row.companyId === companyId && row.id === id)
      if (index < 0) return false
      rows.splice(index, 1)
      return true
    },
    async processDue({ now, limit, handle }) {
      const due = rows
        .filter((row) => row.isActive && row.nextRunAt <= now)
        .sort((left, right) => left.nextRunAt.getTime() - right.nextRunAt.getTime())
        .slice(0, limit)
      for (const row of due) Object.assign(row, await handle({ ...row }))
      return due.length
    },
  }
}
