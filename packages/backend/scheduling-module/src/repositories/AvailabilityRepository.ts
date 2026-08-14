/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq } from 'drizzle-orm'

import type { SchedulingDatabase } from '../database.types'
import {
  availabilityExceptions,
  availabilityRules,
  type AvailabilityExceptionRow,
  type AvailabilityRuleRow,
  type NewAvailabilityExceptionRow,
  type NewAvailabilityRuleRow,
} from '../schema/schema'
import { availabilityExceptionListCondition, availabilityRuleListCondition } from './conditions'

export class AvailabilityRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  async createRule(values: NewAvailabilityRuleRow): Promise<AvailabilityRuleRow> {
    const [row] = await this.db.insert(availabilityRules).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em availability_rules não retornou linha')
    return row
  }

  async listRulesByResource(params: { companyId: string; resourceId: string }): Promise<AvailabilityRuleRow[]> {
    return this.db.select().from(availabilityRules).where(availabilityRuleListCondition(params))
  }

  async deleteRule(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .delete(availabilityRules)
      .where(eq(availabilityRules.companyId, params.companyId))
      .returning({ id: availabilityRules.id })
    return row !== undefined
  }

  async createException(values: NewAvailabilityExceptionRow): Promise<AvailabilityExceptionRow> {
    const [row] = await this.db.insert(availabilityExceptions).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em availability_exceptions não retornou linha')
    return row
  }

  /**
   * Janela `[from, until)` — o cálculo de disponibilidade em leitura (Fase 3) soma/subtrai estas
   * linhas contra a regra semanal, nunca materializa slot (spec §7).
   */
  async listExceptionsByResourceInRange(params: {
    companyId: string
    resourceId: string
  }): Promise<AvailabilityExceptionRow[]> {
    return this.db.select().from(availabilityExceptions).where(availabilityExceptionListCondition(params))
  }
}
