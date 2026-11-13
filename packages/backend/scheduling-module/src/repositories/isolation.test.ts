/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Isolamento multiempresa (T2.7): renderiza o SQL real de cada condição exportada com `PgDialect`
 * e prova que `company_id` está em toda cláusula — sem precisar de Postgres.
 *
 * O valor está em travar **as funções que a produção chama**. Reconstruir a condição aqui
 * testaria o teste.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  availabilityExceptionListCondition,
  availabilityRuleListCondition,
  bookingListCondition,
  bookingOwnedByCondition,
  resourceListCondition,
  resourceOwnedByCondition,
  serviceListCondition,
  serviceOwnedByCondition,
} from './conditions'

const dialect = new PgDialect()
const render = (expression: SQL): string => dialect.sqlToQuery(expression).sql
const renderParams = (expression: SQL): readonly unknown[] => dialect.sqlToQuery(expression).params

const params = { companyId: 'company-a', id: 'row-1', resourceId: 'resource-1' }

describe('toda condição escopa por company_id', () => {
  const conditions: Record<string, SQL> = {
    resourceOwnedByCondition: resourceOwnedByCondition(params),
    resourceListCondition: resourceListCondition(params),
    serviceOwnedByCondition: serviceOwnedByCondition(params),
    serviceListCondition: serviceListCondition(params),
    availabilityRuleListCondition: availabilityRuleListCondition(params),
    availabilityExceptionListCondition: availabilityExceptionListCondition(params),
    bookingOwnedByCondition: bookingOwnedByCondition(params),
    bookingListCondition: bookingListCondition(params),
  }

  for (const [name, condition] of Object.entries(conditions)) {
    it(`${name} inclui company_id`, () => {
      expect(render(condition)).toContain('company_id')
    })
  }

  it('empresas diferentes vinculam parâmetros diferentes', () => {
    const companyA = resourceListCondition({ companyId: 'company-a' })
    const companyB = resourceListCondition({ companyId: 'company-b' })

    expect(render(companyA)).toEqual(render(companyB))
    expect(renderParams(companyA)).toContain('company-a')
    expect(renderParams(companyB)).not.toContain('company-a')
  })
})

describe('soft delete não vaza registro apagado', () => {
  it('recurso e serviço filtram deleted_at is null por construção', () => {
    expect(render(resourceOwnedByCondition(params))).toContain('deleted_at')
    expect(render(resourceListCondition(params))).toContain('deleted_at')
    expect(render(serviceOwnedByCondition(params))).toContain('deleted_at')
    expect(render(serviceListCondition(params))).toContain('deleted_at')
  })

  it('reserva não tem soft delete — cancelamento é status, não exclusão (spec §9)', () => {
    expect(render(bookingOwnedByCondition(params))).not.toContain('deleted_at')
  })
})

describe('id sozinho nunca basta', () => {
  it('a condição de posse compõe company_id E id, sempre', () => {
    const sql = render(resourceOwnedByCondition(params))

    expect(sql).toContain('company_id')
    expect(sql).toContain('"id"')
  })
})
