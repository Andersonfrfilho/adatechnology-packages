/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que um host com reserva como pedido precisa: período na lista de contatos, etiqueta do cliente,
 * automática que também capta, cotação sem resgatar e resultado explícito da captação.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createCampaignSchema, type Lead, type LeadNotifierPort } from '@adatechnology/coupon-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = randomUUID()
const LEAD_CAPTURE = { enabled: true, consentText: 'Aceito receber o cupom (LGPD).' }

async function setup(input: Record<string, unknown> = {}) {
  const sent: Parameters<LeadNotifierPort['sendCoupon']>[0][] = []
  const captured: { lead: Lead; leadTag: string | null }[] = []
  const built = buildTestModule({
    leadNotifier: { sendCoupon: async (event) => void sent.push(event) },
    hooks: { onLeadCaptured: ({ lead, leadTag }) => void captured.push({ lead, leadTag }) },
  })
  const campaign = await built.module.useCases.createCampaign.execute({
    companyId: COMPANY,
    input: createCampaignSchema.parse({
      name: 'Reserva',
      isActive: true,
      discount: { kind: 'percent', value: 10 },
      leadCapture: LEAD_CAPTURE,
      ...input,
    }),
  })
  const capture = (contact: Record<string, unknown>) =>
    built.module.useCases.captureLead.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      input: { consent: true, ...contact },
    })
  return { ...built, campaign, capture, sent, captured }
}

describe('lista de contatos por período', () => {
  it('meio aberto: from inclui, to exclui', async () => {
    const { capture, clock, module, campaign } = await setup()
    clock.set('2026-11-20T10:00:00.000Z')
    await capture({ phone: '11911110001', email: 'a@exemplo.com' })
    clock.set('2026-11-21T10:00:00.000Z')
    await capture({ phone: '11911110002', email: 'b@exemplo.com' })
    const base = {
      companyId: COMPANY,
      campaignId: campaign.id,
      page: 1,
      pageSize: 20,
      sort: 'createdAt' as const,
      order: 'asc' as const,
    }
    const firstDay = await module.useCases.listLeads.execute({
      ...base,
      from: '2026-11-20T00:00:00.000Z',
      to: '2026-11-21T10:00:00.000Z',
    })
    expect(firstDay.data.map((lead) => lead.email)).toEqual(['a@exemplo.com'])
    const fromSecond = await module.useCases.listLeads.execute({ ...base, from: '2026-11-21T10:00:00.000Z' })
    expect(fromSecond.data.map((lead) => lead.email)).toEqual(['b@exemplo.com'])
    const exported = await module.useCases.exportCampaignData.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      userId: 'u',
      format: 'csv',
      filters: { kind: 'leads', query: { sort: 'createdAt', order: 'asc', to: '2026-11-21T00:00:00.000Z' } },
    })
    expect(exported.rowCount).toBe(1)
  })
})

describe('etiqueta do cliente', () => {
  it('vai no gancho onLeadCaptured; sem etiqueta, null (padrão de antes)', async () => {
    const tagged = await setup({ leadTag: 'cupom-inauguracao' })
    await tagged.capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(tagged.captured.map((event) => event.leadTag)).toEqual(['cupom-inauguracao'])
    const plain = await setup()
    await plain.capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(plain.captured.map((event) => event.leadTag)).toEqual([null])
  })

  it('editável; vazio limpa', async () => {
    const { module, campaign } = await setup({ leadTag: 'vip' })
    expect(campaign.leadTag).toBe('vip')
    const cleared = await module.useCases.updateCampaign.execute({
      companyId: COMPANY,
      id: campaign.id,
      input: { leadTag: null },
    })
    expect(cleared.leadTag).toBeNull()
  })
})

describe('automática que também capta', () => {
  it('desconto automático no pedido e contato captado com o código público', async () => {
    const { capture, module, campaign } = await setup({ isAutomatic: true })
    const result = await capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(result).toMatchObject({ outcome: 'created', isNew: true })
    expect(result.couponCode).toBe(campaign.fixedCode ?? 'x')
    const best = await module.useCases.findAutomatic.execute({
      companyId: COMPANY,
      items: [{ productId: 'p', priceCents: 10_000, quantity: 1 }],
    })
    expect(best?.campaign.id).toBe(campaign.id)
  })
})

describe('cotação sem resgatar', () => {
  it('por código e só subtotal: desconto e total, nada gravado', async () => {
    const { module, campaign, persistence } = await setup({ fixedCode: 'RESERVA10' })
    const quote = await module.useCases.quoteCoupon.execute({
      companyId: COMPANY,
      code: 'RESERVA10',
      subtotalCents: 45_000,
    })
    expect(quote).toMatchObject({ valid: true, discountCents: 4_500, subtotalCents: 45_000, totalCents: 40_500 })
    expect(persistence.state.redemptions).toHaveLength(0)
    const auto = await module.useCases.quoteCoupon.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      subtotalCents: 1_000,
    })
    expect(auto.reasons).toEqual(['not_found'])
  })

  it('campanha com escopo e só subtotal: nenhum item elegível (use itens)', async () => {
    const { module } = await setup({ fixedCode: 'SOPACOTE', scope: { kind: 'products', productIds: ['pacote-1'] } })
    const bySubtotal = await module.useCases.quoteCoupon.execute({
      companyId: COMPANY,
      code: 'SOPACOTE',
      subtotalCents: 10_000,
    })
    expect(bySubtotal.reasons).toEqual(['no_eligible_items'])
    const byItems = await module.useCases.quoteCoupon.execute({
      companyId: COMPANY,
      code: 'SOPACOTE',
      items: [{ productId: 'pacote-1', priceCents: 10_000, quantity: 1 }],
    })
    expect(byItems).toMatchObject({ valid: true, totalCents: 9_000 })
  })

  it('reserva como pedido: resgata na criação, libera ao recusar, resgata de novo se reaberta', async () => {
    const { module } = await setup({ fixedCode: 'RESERVA10', usageLimitTotal: 1 })
    const orderRef = { kind: 'reservation-request', id: randomUUID() }
    const items = [{ productId: 'pacote-1', priceCents: 30_000, quantity: 1 }]
    expect(
      (await module.useCases.redeemCoupon.execute({ companyId: COMPANY, code: 'RESERVA10', orderRef, items })).isNew,
    ).toBe(true)
    await module.useCases.releaseRedemption.execute({ companyId: COMPANY, orderRef })
    const other = { kind: 'reservation-request', id: randomUUID() }
    expect(
      (await module.useCases.redeemCoupon.execute({ companyId: COMPANY, code: 'RESERVA10', orderRef: other, items }))
        .isNew,
    ).toBe(true)
  })
})

describe('resultado explícito da captação', () => {
  it('por lead: repetição com o mesmo contato reenvia (codeResent) sem código na tela', async () => {
    const { capture, sent } = await setup({ codeMode: 'per-lead' })
    const first = await capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(first).toMatchObject({ outcome: 'created', codeResent: true })
    expect(first.couponCode).toMatch(/^[A-Z2-9]{8}$/)
    const again = await capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(again).toMatchObject({ outcome: 'already-registered', isNew: false, couponCode: null, codeResent: true })
    const partial = await capture({ phone: '11911110001', email: 'outro@exemplo.com' })
    expect(partial).toMatchObject({ outcome: 'already-registered', couponCode: null, codeResent: false })
    expect(sent).toHaveLength(2)
  })

  it('fixo: repetição devolve o código público', async () => {
    const { capture } = await setup({ fixedCode: 'PUBLICO' })
    await capture({ phone: '11911110001', email: 'a@exemplo.com' })
    expect(await capture({ phone: '11911110001', email: 'x@exemplo.com' })).toMatchObject({
      outcome: 'already-registered',
      couponCode: 'PUBLICO',
    })
  })
})
