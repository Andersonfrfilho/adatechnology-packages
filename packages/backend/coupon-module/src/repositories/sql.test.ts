/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * SQL real das operações que garantem concorrência, capturado num driver de mentira: trava da
 * campanha, entrega de código do lote com SKIP LOCKED, dedupe do lead pelo índice, uso numa consulta.
 */

import { describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/pg-proxy'

import { CampaignRepository } from './CampaignRepository'
import { CouponCodeRepository } from './CouponCodeRepository'
import { LeadRepository } from './LeadRepository'
import { RedemptionRepository } from './RedemptionRepository'

function capture() {
  const statements: { sql: string; params: unknown[] }[] = []
  const db = drizzle(async (sql, params) => {
    statements.push({ sql, params })
    return { rows: [] }
  })
  return { db, statements }
}

describe('SQL de concorrência', () => {
  it('lockById trava a linha da campanha da empresa', async () => {
    const { db, statements } = capture()
    await new CampaignRepository(db).lockById({ companyId: 'a', id: 'c' })
    expect(statements[0]?.sql).toContain('for update')
    expect(statements[0]?.sql).toContain('"company_id" = $')
  })

  it('claimUnassigned: um UPDATE só, com a seleção SKIP LOCKED do código livre e ativo', async () => {
    const { db, statements } = capture()
    await new CouponCodeRepository(db).claimUnassigned({ companyId: 'a', campaignId: 'c', leadId: 'l' })
    expect(statements).toHaveLength(1)
    const text = statements[0]?.sql ?? ''
    expect(text).toContain('update "coupons"."coupons"')
    expect(text).toContain('for update skip locked')
    expect(text).toContain('"lead_id" is null')
    expect(text).toContain('"status" = $')
  })

  it('lead: ON CONFLICT DO NOTHING (o índice único decide a corrida)', async () => {
    const { db, statements } = capture()
    await new LeadRepository(db).insert({
      companyId: 'a',
      campaignId: 'c',
      phone: '55',
      consentText: 'x',
      consentedAt: new Date(),
    })
    expect(statements[0]?.sql).toContain('on conflict do nothing')
  })

  it('códigos: lote grande em blocos, ignorando colisão', async () => {
    const { db, statements } = capture()
    const values = Array.from({ length: 12_000 }, (_, index) => ({
      companyId: 'a',
      campaignId: 'c',
      code: `C${index}`,
    }))
    await new CouponCodeRepository(db).insertMany(values)
    expect(statements).toHaveLength(3)
    expect(statements.every((statement) => statement.sql.includes('on conflict do nothing'))).toBe(true)
  })

  it('uso: total, por código e por cliente numa consulta, só resgates ativos', async () => {
    const { db, statements } = capture()
    await new RedemptionRepository(db).usage({ companyId: 'a', campaignId: 'c', code: 'X', customerRef: 'k' })
    expect(statements).toHaveLength(1)
    const { sql, params } = statements[0] ?? { sql: '', params: [] }
    expect(sql).toContain('filter (where')
    expect(params).toEqual(expect.arrayContaining(['X', 'k', 'redeemed', 'a']))
  })

  it('contador de uso nunca fica negativo', async () => {
    const { db, statements } = capture()
    await new CouponCodeRepository(db).adjustUsedCount({ companyId: 'a', code: 'X', delta: -1 })
    expect(statements[0]?.sql).toContain('greatest(0,')
  })
})
