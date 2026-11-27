/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres: migrations no schema `coupons`, transação com a campanha travada
 * (concorrência de resgate), dedupe pelo índice único, lote com SKIP LOCKED e totais em SQL. Sem
 * `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte é pulada — mesmo padrão dos outros módulos.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { createCampaignSchema, type CartItem } from '@adatechnology/coupon-contracts'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { createCouponModule, type CouponModule } from './CouponModule'
import type { CouponDatabase } from './database.types'
import { runCouponMigrations } from './runMigrations'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe
const CART: CartItem[] = [{ productId: 'p1', categoryIds: ['c1'], priceCents: 10_000, quantity: 1 }]

describeWithDatabase('coupon-module (integração Postgres real)', () => {
  let sql: SQL
  let module: CouponModule
  const companyId = crypto.randomUUID()
  const otherCompanyId = crypto.randomUUID()
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()

  const createCampaign = (input: Record<string, unknown>) =>
    module.useCases.createCampaign.execute({
      companyId,
      input: createCampaignSchema.parse({
        name: 'Integração',
        isActive: true,
        discount: { kind: 'percent', value: 10 },
        ...input,
      }),
    })

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    const db = drizzle({ client: sql }) as unknown as CouponDatabase
    const run = () => runCouponMigrations({ db, migrate: async (target, config) => migrate(target as never, config) })
    await run()
    await run()
    module = createCouponModule({ db })
  })

  afterAll(async () => {
    await sql.close()
  })

  test('código fixo: único na empresa, livre em outra', async () => {
    await createCampaign({ fixedCode: `FIX${suffix}` })
    await expect(createCampaign({ fixedCode: `FIX${suffix}` })).rejects.toMatchObject({ code: 'COUPON_DUPLICATE_CODE' })
    const other = await module.useCases.createCampaign.execute({
      companyId: otherCompanyId,
      input: createCampaignSchema.parse({
        name: 'Outra',
        discount: { kind: 'fixed', value: 100 },
        fixedCode: `FIX${suffix}`,
      }),
    })
    expect(other.fixedCode).toBe(`FIX${suffix}`)
  })

  test('concorrência: dez resgates simultâneos respeitam o limite total', async () => {
    const campaign = await createCampaign({ fixedCode: `RACE${suffix}`, usageLimitTotal: 3 })
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        module.useCases.redeemCoupon.execute({
          companyId,
          code: `RACE${suffix}`,
          orderRef: { kind: 'order', id: `${suffix}-${index}` },
          items: CART,
        }),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    const report = await module.useCases.getCampaignReport.execute({ companyId, id: campaign.id })
    expect(report).toMatchObject({ redemptionCount: 3, discountCents: 3_000, usedCouponCount: 1 })
  })

  test('repetições simultâneas do MESMO pedido no limite: um resgate, as outras devolvem o mesmo', async () => {
    await createCampaign({ fixedCode: `RETRY${suffix}`, usageLimitTotal: 1 })
    const orderRef = { kind: 'order', id: `retry-${suffix}` }
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        module.useCases.redeemCoupon.execute({ companyId, code: `RETRY${suffix}`, orderRef, items: CART }),
      ),
    )
    const fulfilled = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    expect(fulfilled).toHaveLength(6)
    expect(fulfilled.filter((result) => result.isNew)).toHaveLength(1)
    expect(new Set(fulfilled.map((result) => result.redemption.id)).size).toBe(1)
  })

  test('banco recusa percentual acima de 100 mesmo fora do schema', async () => {
    const db = drizzle({ client: sql }) as unknown as CouponDatabase
    const { campaigns } = await import('./schema/schema')
    const insert = async () =>
      db.insert(campaigns).values({
        companyId,
        name: 'Inválida',
        discountKind: 'percent',
        discountValue: 150,
        codeMode: 'fixed',
        leadCapture: { enabled: false, fields: { name: 'off', phone: 'off', email: 'off' }, consentText: '' },
      })
    await expect(insert()).rejects.toThrow()
  })

  test('LGPD: anonimizar libera o contato para novo cadastro', async () => {
    const campaign = await createCampaign({
      fixedCode: `LGPD${suffix}`,
      leadCapture: { enabled: true, consentText: 'LGPD' },
    })
    const input = { phone: '11955554444', email: `lgpd-${suffix.toLowerCase()}@exemplo.com`, consent: true }
    const first = await module.useCases.captureLead.execute({ companyId, campaignId: campaign.id, input })
    await module.useCases.anonymiseLead.execute({ companyId, campaignId: campaign.id, leadId: first.leadId })
    const again = await module.useCases.captureLead.execute({ companyId, campaignId: campaign.id, input })
    expect(again.isNew).toBe(true)
  })

  test('resgate e liberação idempotentes', async () => {
    const campaign = await createCampaign({ fixedCode: `IDEM${suffix}` })
    const orderRef = { kind: 'order', id: `idem-${suffix}` }
    const first = await module.useCases.redeemCoupon.execute({
      companyId,
      code: `IDEM${suffix}`,
      orderRef,
      items: CART,
    })
    const again = await module.useCases.redeemCoupon.execute({
      companyId,
      code: `IDEM${suffix}`,
      orderRef,
      items: CART,
    })
    expect(again).toEqual({ redemption: first.redemption, isNew: false })
    await module.useCases.releaseRedemption.execute({ companyId, orderRef })
    await module.useCases.releaseRedemption.execute({ companyId, orderRef })
    const report = await module.useCases.getCampaignReport.execute({ companyId, id: campaign.id })
    expect(report).toMatchObject({ redemptionCount: 0, releasedCount: 1, usedCouponCount: 0 })
  })

  test('lead: dedupe por telefone canônico, código por lead, busca por dígitos', async () => {
    const campaign = await createCampaign({ codeMode: 'per-lead', leadCapture: { enabled: true, consentText: 'LGPD' } })
    const capture = (phone: string, email: string) =>
      module.useCases.captureLead.execute({
        companyId,
        campaignId: campaign.id,
        input: { phone, email, consent: true },
      })
    const ana = await capture('(11) 98765-4321', 'ana@exemplo.com')
    const repeated = await capture('+55 11 98765-4321', 'outra@exemplo.com')
    expect(repeated).toMatchObject({ isNew: false, leadId: ana.leadId, couponCode: null })
    const page = await module.useCases.listLeads.execute({
      companyId,
      campaignId: campaign.id,
      page: 1,
      pageSize: 10,
      sort: 'createdAt',
      order: 'desc',
      search: '98765',
    })
    expect(page.pagination.total).toBe(1)
    const validation = await module.useCases.validateCoupon.execute({
      companyId,
      code: ana.couponCode ?? '',
      items: CART,
    })
    expect(validation).toMatchObject({ valid: true, discountCents: 1_000 })
  })

  test('lote: captação simultânea nunca entrega o mesmo código', async () => {
    const campaign = await createCampaign({
      codeMode: 'batch',
      codePrefix: 'LT',
      leadCapture: { enabled: true, consentText: 'LGPD' },
    })
    await module.useCases.generateCodes.execute({ companyId, id: campaign.id, count: 5 })
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        module.useCases.captureLead.execute({
          companyId,
          campaignId: campaign.id,
          input: { phone: `1199999000${index}`, email: `p${index}@exemplo.com`, consent: true },
        }),
      ),
    )
    const codes = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value.couponCode] : []))
    expect(codes).toHaveLength(5)
    expect(new Set(codes).size).toBe(5)
  })

  test('lista com situação e estatística, exportação e exclusão bloqueada com histórico', async () => {
    const campaign = await createCampaign({ name: `Lista ${suffix}`, fixedCode: `LST${suffix}` })
    await module.useCases.redeemCoupon.execute({
      companyId,
      code: `LST${suffix}`,
      orderRef: { kind: 'order', id: `lst-${suffix}` },
      items: CART,
    })
    const page = await module.useCases.listCampaigns.execute({
      companyId,
      page: 1,
      pageSize: 50,
      sort: 'createdAt',
      order: 'desc',
      search: `Lista ${suffix}`,
      state: ['running'],
    })
    expect(page.data.map((item) => item.stats)).toEqual([{ redemptionCount: 1, discountCents: 1_000, leadCount: 0 }])
    const exported = await module.useCases.exportCampaignData.execute({
      companyId,
      campaignId: campaign.id,
      userId: undefined,
      format: 'csv',
      filters: { kind: 'redemptions', query: { sort: 'redeemedAt', order: 'desc' } },
    })
    expect(exported.rowCount).toBe(1)
    await expect(module.useCases.removeCampaign.execute({ companyId, id: campaign.id })).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_IN_USE',
    })
    await expect(
      module.useCases.getCampaign.execute({ companyId: otherCompanyId, id: campaign.id }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
