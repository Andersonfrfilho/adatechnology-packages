/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderiza o SQL real de cada condição exportada e prova que `company_id` está em toda cláusula —
 * sem Postgres. Testa as funções que a produção chama, não uma reconstrução delas.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  campaignActivityConditions,
  campaignListCondition,
  campaignOpenCondition,
  campaignOwnedCondition,
  couponCodeCondition,
  couponListCondition,
  couponOwnedCondition,
  leadContactCondition,
  leadListCondition,
  leadOwnedCondition,
  likePattern,
  redemptionActiveCondition,
  redemptionListCondition,
  redemptionOrderCondition,
  redemptionOwnedCondition,
} from './conditions'

const dialect = new PgDialect()
const now = new Date('2026-11-20T12:00:00.000Z')
const company = 'company-a'
const activity = campaignActivityConditions({ companyId: company, id: 'c' })

describe('toda condição escopa por company_id', () => {
  const conditions: Record<string, SQL> = {
    campaignOwnedCondition: campaignOwnedCondition({ companyId: company, id: 'c' }),
    campaignListCondition: campaignListCondition({
      companyId: company,
      search: 'x',
      states: ['running', 'ended'],
      now,
    }),
    campaignOpenCondition: campaignOpenCondition({ companyId: company, now, automaticOnly: true }),
    couponCodeCondition: couponCodeCondition({ companyId: company, code: 'X' }),
    couponOwnedCondition: couponOwnedCondition({ companyId: company, id: 'x' }),
    couponListCondition: couponListCondition({ companyId: company, campaignId: 'c', search: 'x', unassigned: true }),
    leadOwnedCondition: leadOwnedCondition({ companyId: company, id: 'l' }),
    leadContactCondition: leadContactCondition({ companyId: company, campaignId: 'c', phone: '5511', email: null }),
    leadListCondition: leadListCondition({ companyId: company, campaignId: 'c', search: '(11) 9' }),
    redemptionOrderCondition: redemptionOrderCondition({ companyId: company, orderKind: 'order', orderId: '1' }),
    redemptionOwnedCondition: redemptionOwnedCondition({ companyId: company, id: 'r' }),
    redemptionActiveCondition: redemptionActiveCondition({ companyId: company, campaignId: 'c' }),
    redemptionListCondition: redemptionListCondition({
      companyId: company,
      campaignId: 'c',
      search: 'x',
      statuses: ['redeemed'],
    }),
    activityLeads: activity.leads,
    activityRedemptions: activity.redemptions,
  }
  for (const [name, condition] of Object.entries(conditions)) {
    it(name, () => {
      const query = dialect.sqlToQuery(condition)
      expect(query.sql).toContain('"company_id" = $')
      expect(query.params).toContain(company)
    })
  }
})

describe('detalhes das condições', () => {
  it('lead sem contato não casa com nada', () => {
    expect(
      dialect.sqlToQuery(leadContactCondition({ companyId: company, campaignId: 'c', phone: null, email: null })).sql,
    ).toContain('false')
  })

  it('busca escapa curinga e telefone compara dígitos', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%')
    const query = dialect.sqlToQuery(leadListCondition({ companyId: company, campaignId: 'c', search: '(11) 9' }))
    expect(query.params).toContain('%119%')
  })

  it('situação "no ar" exige ligada, já começou e não acabou', () => {
    const { sql } = dialect.sqlToQuery(campaignOpenCondition({ companyId: company, now, automaticOnly: false }))
    expect(sql).toContain('"is_active" = $')
    expect(sql).toContain('"starts_at" is null or')
    expect(sql).toContain('"ends_at" is null or')
  })
})
