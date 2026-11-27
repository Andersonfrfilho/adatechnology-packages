/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { Campaign, CampaignListItem, PublicCampaign } from '@adatechnology/coupon-contracts'

import { validateLeadForm } from '../hooks/useLeadCapture'
import { resolveCouponsMessages } from '../locales'
import { readErrorCode, readFieldIssues, readRejections } from './apiError'
import { draftFromCampaign, draftToInput, EMPTY_CAMPAIGN_DRAFT, validateDraft } from './campaignDraft'
import { buildCampaignTable } from './campaignSpreadsheet'
import { formatCentsInput, formatPhone, maskPhoneInput, parseCentsInput } from './format'
import { fieldLabel, rejectionMessage } from './labels'
import { DEFAULT_CAMPAIGN_LIST_STATE, parseCampaignListState, serializeCampaignListState } from './listUrlState'

const messages = resolveCouponsMessages('pt-BR')

const CAMPAIGN: Campaign = {
  id: 'c1',
  companyId: 'co',
  name: 'Inauguração',
  title: 'Ganhe 10%',
  text: '',
  terms: '',
  isActive: true,
  startsAt: null,
  endsAt: '2026-12-31T23:59:00.000Z',
  discount: { kind: 'fixed', value: 2_500, maxDiscountCents: null, minSubtotalCents: 10_000 },
  codeMode: 'fixed',
  fixedCode: 'BEMVINDO',
  codePrefix: null,
  usageLimitTotal: 100,
  usageLimitPerCustomer: 1,
  usageLimitPerCode: null,
  scope: { kind: 'tags', tags: ['verao', 'praia'] },
  isAutomatic: false,
  leadCapture: { enabled: true, fields: { name: 'optional', phone: 'required', email: 'off' }, consentText: 'Aceito.' },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

describe('máscaras', () => {
  it('moeda: dígitos são centavos', () => {
    expect(parseCentsInput('R$ 1.234,56')).toBe(123_456)
    expect(parseCentsInput('')).toBeNull()
    expect(formatCentsInput(123_456)).toBe('1.234,56')
    expect(formatCentsInput(5)).toBe('0,05')
  })

  it('telefone progressivo e exibição com DDI', () => {
    expect(maskPhoneInput('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhoneInput('1132221')).toBe('(11) 3222-1')
    expect(formatPhone('5511987654321')).toBe('+55 (11) 98765-4321')
  })
})

describe('rascunho da campanha', () => {
  it('ida e volta preserva desconto, limites, escopo e captação', () => {
    const input = draftToInput(draftFromCampaign(CAMPAIGN))
    expect(input).toMatchObject({
      discount: { kind: 'fixed', value: 2_500, maxDiscountCents: null, minSubtotalCents: 10_000 },
      usageLimitTotal: 100,
      usageLimitPerCustomer: 1,
      usageLimitPerCode: null,
      scope: { kind: 'tags', tags: ['verao', 'praia'] },
      fixedCode: 'BEMVINDO',
      leadCapture: CAMPAIGN.leadCapture,
    })
    expect(input.endsAt).toBe('2026-12-31T23:59:00.000Z')
  })

  it('valida com o schema do servidor e lista todos os campos', () => {
    const issues = validateDraft(
      {
        ...EMPTY_CAMPAIGN_DRAFT,
        percent: '150',
        leadCaptureEnabled: true,
        leadFields: { name: 'off', phone: 'optional', email: 'off' },
      },
      true,
    )
    expect(issues.map((issue) => issue.field)).toEqual([
      'name',
      'discount.value',
      'leadCapture.fields',
      'leadCapture.consentText',
    ])
  })

  it('edição confere regras que cruzam campos', () => {
    const draft = { ...draftFromCampaign(CAMPAIGN), startsAt: '2027-01-10T10:00' }
    expect(validateDraft(draft, false).map((issue) => issue.field)).toEqual(['endsAt'])
  })
})

describe('estado da lista na URL', () => {
  it('ida e volta, sem apagar parâmetro do host e sem poluir com o padrão', () => {
    const state = {
      ...DEFAULT_CAMPAIGN_LIST_STATE,
      search: 'natal',
      states: ['running', 'scheduled'] as const,
      page: 3,
      sort: 'name' as const,
      order: 'asc' as const,
    }
    const query = serializeCampaignListState({ ...state, states: [...state.states] }, 'tab=promo')
    expect(query).toContain('tab=promo')
    expect(parseCampaignListState(query)).toEqual({ ...state, states: ['running', 'scheduled'] })
    expect(serializeCampaignListState(DEFAULT_CAMPAIGN_LIST_STATE)).toBe('')
    expect(parseCampaignListState('campaigns.state=bogus,ended&campaigns.pageSize=7').states).toEqual(['ended'])
  })
})

describe('erro da API', () => {
  it('lê campos e motivos no erro ou em body.error, sem repetir campo', () => {
    const error = {
      body: {
        error: {
          code: 'COUPON_LEAD_INVALID',
          details: {
            fields: [
              { field: 'phone', message: 'a' },
              { field: 'phone', message: 'b' },
              { field: 'email', message: 'c' },
            ],
          },
        },
      },
    }
    expect(readErrorCode(error)).toBe('COUPON_LEAD_INVALID')
    expect(readFieldIssues(error).map((issue) => issue.field)).toEqual(['phone', 'email'])
    expect(readRejections({ code: 'X', details: { reasons: ['expired'] } })).toEqual(['expired'])
    expect(readFieldIssues('boom')).toEqual([])
  })

  it('rótulo do campo; desconhecido sai cru', () => {
    expect(fieldLabel(messages, 'discount.value')).toBe('Percentual (%)')
    expect(fieldLabel(messages, 'leadCapture.fields.phone')).toBe('WhatsApp')
    expect(fieldLabel(messages, 'misterio')).toBe('misterio')
    expect(rejectionMessage(messages, 'expired')).toBe('O cupom expirou.')
  })
})

describe('planilha da lista', () => {
  it('mesmas colunas, dinheiro como número', () => {
    const item: CampaignListItem = { ...CAMPAIGN, stats: { redemptionCount: 4, discountCents: 10_000, leadCount: 7 } }
    const table = buildCampaignTable({ campaigns: [item], messages, now: new Date('2026-11-20T00:00:00Z') })
    expect(table.header[0]).toBe('Nome')
    expect(table.rows[0]).toEqual(['Inauguração', 'BEMVINDO', 'No ar', 25, null, '2026-12-31T23:59:00.000Z', 4, 100, 7])
  })
})

describe('formulário de captação', () => {
  const campaign: PublicCampaign = { ...CAMPAIGN }
  const texts = { required: 'obrigatório', invalid: 'inválido', consent: 'aceite' }

  it('só os campos pedidos, formato e aceite de uma vez', () => {
    expect(validateLeadForm(campaign, { name: '', phone: '123', email: 'x', consent: false }, texts)).toEqual([
      { field: 'phone', message: 'inválido' },
      { field: 'consent', message: 'aceite' },
    ])
    expect(validateLeadForm(campaign, { name: '', phone: '(11) 98765-4321', email: '', consent: true }, texts)).toEqual(
      [],
    )
  })
})
