/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Captação: deduplicação por contato canônico, os três modos de código, consentimento, portas do
 * host isoladas e nenhum dado pessoal no log.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createCampaignSchema, type CouponModuleConfig, type LeadNotifierPort } from '@adatechnology/coupon-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = randomUUID()
const LEAD_CAPTURE = { enabled: true, consentText: 'Aceito receber o cupom (LGPD).' }

type Sent = Parameters<LeadNotifierPort['sendCoupon']>[0]

async function setup(
  input: Record<string, unknown> = {},
  options: { failingNotifier?: boolean; config?: CouponModuleConfig } = {},
) {
  const sent: Sent[] = []
  const built = buildTestModule({
    ...(options.config ? { config: options.config } : {}),
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
    // Repetição com e-mail diferente do guardado: "já cadastrado", nada é enviado a ninguém.
    expect(sent.map((item) => item.isResend)).toEqual([false])
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

describe('reenvio na repetição', () => {
  it('contato idêntico: reenvia, e para o contato GUARDADO', async () => {
    const { capture, sent } = await setup({ codeMode: 'per-lead' })
    await capture({ name: 'Ana', phone: '(11) 98765-4321', email: 'ana@exemplo.com' })
    await capture({ name: 'Outro nome', phone: '+55 11 98765-4321', email: 'ANA@exemplo.com' })
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({
      isResend: true,
      contact: { name: 'Ana', phone: '5511987654321', email: 'ana@exemplo.com' },
    })
  })

  it('casamento parcial (telefone igual, e-mail outro, ou o contrário) não envia para o endereço novo nem para ninguém', async () => {
    const { capture, sent } = await setup({ codeMode: 'per-lead' })
    await capture({ phone: '11987654321', email: 'ana@exemplo.com' })
    const byPhone = await capture({ phone: '11987654321', email: 'atacante@exemplo.com' })
    const byEmail = await capture({ phone: '21999998888', email: 'ana@exemplo.com' })
    expect(byPhone).toMatchObject({ isNew: false, couponCode: null })
    expect(byEmail).toMatchObject({ isNew: false, couponCode: null })
    expect(sent).toHaveLength(1)
    expect(JSON.stringify(sent)).not.toContain('atacante')
  })
})

describe('limites da captação', () => {
  it('teto diário por campanha', async () => {
    const { capture, clock } = await setup({}, { config: { maxLeadsPerCampaignPerDay: 1 } })
    await capture({ phone: '11987654321', email: 'ana@exemplo.com' })
    await expect(capture({ phone: '11911112222', email: 'bia@exemplo.com' })).rejects.toMatchObject({
      code: 'COUPON_RATE_LIMITED',
    })
    // Repetição de quem já está cadastrado não conta como novo.
    expect((await capture({ phone: '11987654321', email: 'ana@exemplo.com' })).isNew).toBe(false)
    clock.set('2026-11-21T00:00:01.000Z')
    expect((await capture({ phone: '11911112222', email: 'bia@exemplo.com' })).isNew).toBe(true)
  })

  it('campanha fixa sem código não capta (não entrega código vazio)', async () => {
    const { capture, persistence } = await setup()
    for (const row of persistence.state.campaigns) row.fixedCode = null
    await expect(capture({ phone: '11987654321', email: 'ana@exemplo.com' })).rejects.toMatchObject({
      code: 'COUPON_CAMPAIGN_UNAVAILABLE',
    })
    expect(persistence.state.leads).toHaveLength(0)
  })
})

describe('LGPD', () => {
  it('anonimiza só o contato da campanha e da empresa', async () => {
    const { capture, module, campaign, persistence } = await setup({ codeMode: 'per-lead' })
    const { leadId } = await capture({ name: 'Ana', phone: '11987654321', email: 'ana@exemplo.com' })
    await expect(
      module.useCases.anonymiseLead.execute({ companyId: randomUUID(), campaignId: campaign.id, leadId }),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      module.useCases.anonymiseLead.execute({ companyId: COMPANY, campaignId: randomUUID(), leadId }),
    ).rejects.toMatchObject({ statusCode: 404 })
    await module.useCases.anonymiseLead.execute({ companyId: COMPANY, campaignId: campaign.id, leadId })
    expect(persistence.state.leads[0]).toMatchObject({
      name: null,
      phone: null,
      email: null,
      customerRef: null,
      couponCode: null,
    })
    // Depois de anonimizado, o mesmo contato pode se cadastrar de novo.
    expect((await capture({ phone: '11987654321', email: 'ana@exemplo.com' })).isNew).toBe(true)
  })
})

describe('auditoria', () => {
  it('avisa no boot quando falta o gancho de exportação; exportação loga o usuário', async () => {
    const { logger, module, campaign } = await setup()
    expect(logger.entries.some((entry) => entry.level === 'warn' && entry.message.includes('onExported'))).toBe(true)
    await module.useCases.exportCampaignData.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      userId: 'user-9',
      format: 'csv',
      filters: { kind: 'leads', query: { sort: 'createdAt', order: 'desc' } },
    })
    expect(logger.entries.find((entry) => entry.message === 'coupons: exportação')?.meta).toMatchObject({
      userId: 'user-9',
    })
  })
})
