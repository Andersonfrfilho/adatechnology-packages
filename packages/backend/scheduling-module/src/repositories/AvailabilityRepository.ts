/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq, sql } from 'drizzle-orm'

import type { SchedulingDatabase } from '../database.types'
import {
  availabilityExceptions,
  availabilityRules,
  resources,
  type AvailabilityExceptionRow,
  type AvailabilityRuleRow,
  type NewAvailabilityExceptionRow,
  type NewAvailabilityRuleRow,
} from '../schema/schema'
import {
  availabilityExceptionListCondition,
  availabilityRuleListCondition,
  resourceOwnedByCondition,
} from './conditions'

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

  /**
   * Hora de parede (`HH:mm`) → instante, pelo fuso do próprio recurso — via `AT TIME ZONE` do
   * Postgres, nunca offset fixo calculado no código (spec §5.3, T3.2). É a única conversão do
   * módulo que depende de Postgres real: `(data + hora) AT TIME ZONE zona` resolve o deslocamento
   * certo mesmo quando a data cai do outro lado de uma virada de horário de verão.
   */
  async resolveLocalInstant(params: {
    companyId: string
    resourceId: string
    localDate: string
    localTime: string
  }): Promise<Date> {
    const [row] = await this.db
      .select({
        instant: sql<Date>`(${params.localDate}::date + ${params.localTime}::time) AT TIME ZONE ${resources.timezone}`,
      })
      .from(resources)
      .where(resourceOwnedByCondition({ companyId: params.companyId, id: params.resourceId }))
      .limit(1)
    if (!row) throw new Error('scheduling-module: recurso não encontrado ao resolver hora local')
    return row.instant
  }
}
