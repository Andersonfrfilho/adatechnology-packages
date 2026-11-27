/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createCampaignSchema, type Campaign } from '@adatechnology/coupon-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = randomUUID()
const OTHER = randomUUID()

const create = (
  module: ReturnType<typeof buildTestModule>['module'],
  input: Record<string, unknown>,
  companyId = COMPANY,
): Promise<Campaign> =>
  module.useCases.createCampaign.execute({
    companyId,
    input: createCampaignSchema.parse({ name: 'Inauguração', discount: { kind: 'percent', value: 10 }, ...input }),
  })

describe('campanhas', () => {
  it('modo fixo sem código gera um e grava como cupom', async () => {
    const { module, persistence } = buildTestModule()
    const campaign = await create(module, {})
    expect(campaign.fixedCode).toMatch(/^[A-Z2-9]{8}$/)
    expect(persistence.state.coupons.map((row) => row.code)).toEqual([campaign.fixedCode ?? ''])
  })

  it('código fixo repetido na mesma empresa é 409; em outra empresa pode', async () => {
    const { module } = buildTestModule()
    await create(module, { fixedCode: 'BEMVINDO' })
    await expect(create(module, { fixedCode: 'bemvindo' })).rejects.toMatchObject({
      code: 'COUPON_DUPLICATE_CODE',
      statusCode: 409,
    })
    expect((await create(module, { fixedCode: 'BEMVINDO' }, OTHER)).fixedCode).toBe('BEMVINDO')
  })

  it('erro na criação desfaz a campanha inteira', async () => {
    const { module, persistence } = buildTestModule()
    await create(module, { fixedCode: 'UNICO' })
    await expect(create(module, { fixedCode: 'UNICO' })).rejects.toThrow()
    expect(persistence.state.campaigns).toHaveLength(1)
  })

  it('edição troca o código fixo e confere as regras depois do merge', async () => {
    const { module, persistence } = buildTestModule()
    const campaign = await create(module, { fixedCode: 'VERAO' })
    const updated = await module.useCases.updateCampaign.execute({
      companyId: COMPANY,
      id: campaign.id,
      input: { fixedCode: 'VERAO26' },
    })
    expect(updated.fixedCode).toBe('VERAO26')
    expect(persistence.state.coupons.map((row) => row.code)).toEqual(['VERAO26'])
    await expect(
      module.useCases.updateCampaign.execute({
        companyId: COMPANY,
        id: campaign.id,
        input: { startsAt: '2026-12-10T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
      }),
    ).rejects.toMatchObject({ code: 'COUPON_CAMPAIGN_INVALID', publicDetails: { fields: [{ field: 'endsAt' }] } })
  })

  it('outra empresa recebe 404', async () => {
    const { module } = buildTestModule()
    const campaign = await create(module, {})
    await expect(module.useCases.getCampaign.execute({ companyId: OTHER, id: campaign.id })).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(module.useCases.removeCampaign.execute({ companyId: OTHER, id: campaign.id })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('apaga sem uso; com uso responde 409', async () => {
    const { module } = buildTestModule()
    const unused = await create(module, {})
    await module.useCases.removeCampaign.execute({ companyId: COMPANY, id: unused.id })
    const used = await create(module, { isActive: true, fixedCode: 'USADO' })
    await module.useCases.redeemCoupon.execute({
      companyId: COMPANY,
      code: 'USADO',
      orderRef: { kind: 'order', id: '1' },
      items: [{ productId: 'p', priceCents: 1000, quantity: 1 }],
    })
    await expect(module.useCases.removeCampaign.execute({ companyId: COMPANY, id: used.id })).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_IN_USE',
    })
  })

  it('lista com busca, situação, total e estatística', async () => {
    const { module } = buildTestModule()
    await create(module, { name: 'Natal', isActive: true })
    await create(module, { name: 'Páscoa', isActive: true, startsAt: '2027-03-01T00:00:00Z' })
    await create(module, { name: 'Antiga', isActive: true, endsAt: '2026-01-01T00:00:00Z' })
    const all = await module.useCases.listCampaigns.execute({
      companyId: COMPANY,
      page: 1,
      pageSize: 2,
      sort: 'name',
      order: 'asc',
    })
    expect(all.pagination).toEqual({ total: 3, page: 1, pageSize: 2, totalPages: 2 })
    expect(all.data.map((item) => item.name)).toEqual(['Antiga', 'Natal'])
    expect(all.data[0]?.stats).toEqual({ redemptionCount: 0, discountCents: 0, leadCount: 0 })
    const running = await module.useCases.listCampaigns.execute({
      companyId: COMPANY,
      page: 1,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
      state: ['running', 'scheduled'],
    })
    expect(running.data.map((item) => item.name)).toEqual(['Natal', 'Páscoa'])
    const searched = await module.useCases.listCampaigns.execute({
      companyId: COMPANY,
      page: 1,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
      search: 'nat',
    })
    expect(searched.pagination.total).toBe(1)
  })

  it('lote: só em campanha de lote, com prefixo e sem repetição', async () => {
    const { module, persistence } = buildTestModule()
    const fixed = await create(module, {})
    await expect(
      module.useCases.generateCodes.execute({ companyId: COMPANY, id: fixed.id, count: 3 }),
    ).rejects.toMatchObject({ code: 'COUPON_WRONG_CODE_MODE' })
    const batch = await create(module, { codeMode: 'batch', codePrefix: 'loja' })
    const result = await module.useCases.generateCodes.execute({ companyId: COMPANY, id: batch.id, count: 500 })
    expect(result).toEqual({ generated: 500, prefix: 'LOJA' })
    const codes = persistence.state.coupons.filter((row) => row.campaignId === batch.id).map((row) => row.code)
    expect(new Set(codes).size).toBe(500)
    expect(codes.every((code) => code.startsWith('LOJA-'))).toBe(true)
  })

  it('edição do desconto campo a campo junta com o salvo e revalida o conjunto', async () => {
    const { module } = buildTestModule()
    const campaign = await create(module, { discount: { kind: 'percent', value: 10, maxDiscountCents: 5_000 } })
    const updated = await module.useCases.updateCampaign.execute({
      companyId: COMPANY,
      id: campaign.id,
      input: { discount: { value: 20 } },
    })
    expect(updated.discount).toEqual({ kind: 'percent', value: 20, maxDiscountCents: 5_000, minSubtotalCents: null })
    await expect(
      module.useCases.updateCampaign.execute({
        companyId: COMPANY,
        id: campaign.id,
        input: { discount: { value: 150 } },
      }),
    ).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_INVALID',
      publicDetails: { fields: [{ field: 'discount.value' }] },
    })
    const fixed = await module.useCases.updateCampaign.execute({
      companyId: COMPANY,
      id: campaign.id,
      input: { discount: { kind: 'fixed', value: 1_500 } },
    })
    expect(fixed.discount).toMatchObject({ kind: 'fixed', value: 1_500, maxDiscountCents: 5_000 })
  })
})
