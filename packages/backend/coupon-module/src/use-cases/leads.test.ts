/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Captação: deduplicação por contato canônico, os três modos de código, consentimento, portas do
 * host isoladas e nenhum dado pessoal no log.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createCampaignSchema, type LeadNotifierPort } from '@adatechnology/coupon-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = randomUUID()
const LEAD_CAPTURE = { enabled: true, consentText: 'Aceito receber o cupom (LGPD).' }

type Sent = Parameters<LeadNotifierPort['sendCoupon']>[0]

async function setup(input: Record<string, unknown> = {}, options: { failingNotifier?: boolean } = {}) {
  const sent: Sent[] = []
  const built = buildTestModule({
    leadNotifier: {
      async sendCoupon(params) {
        if (options.failingNotifier) throw new Error('smtp fora do ar')
        sent.push(params)
      },
    },
    customerIdentity: { resolve: async () => 'customer-1' },
  })
  const campaign = await built.module.useCases.createCampaign.execute({
    companyId: COMPANY,
    input: createCampaignSchema.parse({
      name: 'Captação',
      isActive: true,
      discount: { kind: 'percent', value: 15 },
      leadCapture: LEAD_CAPTURE,
      ...input,
    }),
  })
  const capture = (input: Record<string, unknown>) =>
    built.module.useCases.captureLead.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      input: { consent: true, ...input },
    })
  return { ...built, campaign, capture, sent }
}

describe('captação', () => {
  it('fixo: devolve o código público sempre, deduplica pelo telefone formatado de outro jeito', async () => {
    const { capture, campaign, persistence, sent } = await setup({ fixedCode: 'BEMVINDO' })
    const first = await capture({ name: 'Ana', phone: '(11) 98765-4321', email: 'Ana@Exemplo.com' })
    const again = await capture({ phone: '+55 11 98765 4321', email: 'outra@exemplo.com' })
    expect(first).toMatchObject({ isNew: true, couponCode: 'BEMVINDO', discount: { kind: 'percent', value: 15 } })
    expect(again).toMatchObject({ isNew: false, couponCode: 'BEMVINDO', leadId: first.leadId })
    expect(persistence.state.leads).toHaveLength(1)
    expect(persistence.state.leads[0]).toMatchObject({
      phone: '5511987654321',
      email: 'ana@exemplo.com',
      customerRef: 'customer-1',
      consentText: LEAD_CAPTURE.consentText,
    })
    expect(sent.map((item) => item.isResend)).toEqual([false, true])
    expect(sent[0]?.campaign.id).toBe(campaign.id)
  })

  it('deduplica também pelo e-mail', async () => {
    const { capture, persistence } = await setup()
    await capture({ phone: '11987654321', email: 'ana@exemplo.com' })
    expect((await capture({ phone: '21999998888', email: ' ANA@exemplo.com ' })).isNew).toBe(false)
    expect(persistence.state.leads).toHaveLength(1)
  })

  it('por lead: cada pessoa um código; repetir não revela o código na tela', async () => {
    const { capture, persistence } = await setup({ codeMode: 'per-lead', codePrefix: 'VIP' })
    const ana = await capture({ phone: '11987654321', email: 'ana@exemplo.com' })
    const bia = await capture({ phone: '11911112222', email: 'bia@exemplo.com' })
    expect(ana.couponCode).toMatch(/^VIP-[A-Z2-9]{8}$/)
    expect(bia.couponCode).not.toBe(ana.couponCode)
    expect((await capture({ phone: '11987654321', email: 'ana@exemplo.com' })).couponCode).toBeNull()
    expect(persistence.state.coupons.find((row) => row.code === ana.couponCode)?.leadId).toBe(ana.leadId)
  })

  it('lote: entrega o próximo livre; esgotado desfaz o lead', async () => {
    const { capture, module, campaign, persistence } = await setup({ codeMode: 'batch' })
    await module.useCases.generateCodes.execute({ companyId: COMPANY, id: campaign.id, count: 1 })
    const first = await capture({ phone: '11987654321', email: 'ana@exemplo.com' })
    expect(first.couponCode).toBe(persistence.state.coupons[0]?.code ?? 'x')
    await expect(capture({ phone: '11911112222', email: 'bia@exemplo.com' })).rejects.toMatchObject({
      code: 'COUPON_CODES_EXHAUSTED',
    })
    expect(persistence.state.leads).toHaveLength(1)
  })

  it('sem consentimento é recusado', async () => {
    const { capture } = await setup()
    await expect(capture({ phone: '11987654321', email: 'ana@exemplo.com', consent: false })).rejects.toMatchObject({
      code: 'COUPON_CONSENT_REQUIRED',
    })
  })

  it('lista todos os campos inválidos de uma vez', async () => {
    const { capture } = await setup()
    await expect(capture({ phone: '123', email: 'ana@' })).rejects.toMatchObject({
      code: 'COUPON_LEAD_INVALID',
      publicDetails: { fields: [{ field: 'phone' }, { field: 'email' }] },
    })
  })

  it('campanha sem captação, desligada ou encerrada: mesma resposta', async () => {
    const off = await setup({ isActive: false })
    await expect(off.capture({ phone: '11987654321', email: 'a@b.co' })).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_UNAVAILABLE',
    })
    const ended = await setup({ endsAt: '2026-11-01T00:00:00Z' })
    await expect(ended.capture({ phone: '11987654321', email: 'a@b.co' })).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_UNAVAILABLE',
    })
  })

  it('aviso que falha não desfaz o cadastro, e o log não leva contato nem código', async () => {
    const { capture, persistence, logger } = await setup({ codeMode: 'per-lead' }, { failingNotifier: true })
    const result = await capture({ name: 'Ana Souza', phone: '11987654321', email: 'ana@exemplo.com' })
    expect(result.isNew).toBe(true)
    expect(persistence.state.leads).toHaveLength(1)
    const logged = JSON.stringify(logger.entries)
    expect(logger.entries.some((entry) => entry.level === 'error')).toBe(true)
    for (const secret of ['98765', 'ana@exemplo.com', 'Ana Souza', 'smtp', result.couponCode ?? 'x'])
      expect(logged).not.toContain(secret)
  })

  it('lista de leads busca pelos dígitos do telefone', async () => {
    const { capture, module, campaign } = await setup()
    await capture({ name: 'Ana', phone: '11987654321', email: 'ana@exemplo.com' })
    await capture({ name: 'Bia', phone: '21911112222', email: 'bia@exemplo.com' })
    const found = await module.useCases.listLeads.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      page: 1,
      pageSize: 20,
      sort: 'createdAt',
      order: 'desc',
      search: '(21) 9111',
    })
    expect(found.data.map((lead) => lead.name)).toEqual(['Bia'])
    expect(found.pagination.total).toBe(1)
  })
})

describe('exportação', () => {
  it('CSV e XLSX com todos os resultados do filtro, e trilha de auditoria', async () => {
    const audits: unknown[] = []
    const built = buildTestModule({ hooks: { onExported: (event) => void audits.push(event) } })
    const campaign = await built.module.useCases.createCampaign.execute({
      companyId: COMPANY,
      input: createCampaignSchema.parse({
        name: 'Export',
        isActive: true,
        fixedCode: 'EXP',
        discount: { kind: 'fixed', value: 250 },
        leadCapture: LEAD_CAPTURE,
      }),
    })
    for (const index of [1, 2, 3])
      await built.module.useCases.redeemCoupon.execute({
        companyId: COMPANY,
        code: 'EXP',
        orderRef: { kind: 'order', id: `o${index}` },
        items: [{ productId: 'p', priceCents: 1_000, quantity: 1 }],
      })
    const csv = await built.module.useCases.exportCampaignData.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      userId: 'user-1',
      format: 'csv',
      filters: { kind: 'redemptions', query: { sort: 'redeemedAt', order: 'asc', search: 'o2' } },
    })
    expect(csv).toMatchObject({ rowCount: 1, isTruncated: false, contentType: 'text/csv; charset=utf-8' })
    expect(csv.fileName).toBe('redemptions-2026-11-20.csv')
    expect(String(csv.body)).toContain(',redeemed,EXP,order,o2,,10,2.5,')
    const xlsx = await built.module.useCases.exportCampaignData.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      userId: 'user-1',
      format: 'xlsx',
      filters: { kind: 'redemptions', query: { sort: 'redeemedAt', order: 'asc' } },
    })
    expect(xlsx.rowCount).toBe(3)
    expect(xlsx.body).toBeInstanceOf(Uint8Array)
    expect(audits).toEqual([
      {
        companyId: COMPANY,
        userId: 'user-1',
        campaignId: campaign.id,
        kind: 'redemptions',
        format: 'csv',
        filters: { sort: 'redeemedAt', order: 'asc', search: 'o2' },
        rowCount: 1,
      },
      {
        companyId: COMPANY,
        userId: 'user-1',
        campaignId: campaign.id,
        kind: 'redemptions',
        format: 'xlsx',
        filters: { sort: 'redeemedAt', order: 'asc' },
        rowCount: 3,
      },
    ])
  })
})
