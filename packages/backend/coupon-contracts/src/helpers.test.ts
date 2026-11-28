/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  generateCouponCode,
  GENERATED_CODE_ALPHABET,
  isValidCouponCode,
  normalizeCouponCode,
  cryptoRandomInt,
} from './code'
import { canonicalEmail, canonicalPhone, maskPhone } from './contact'
import { checkCampaignRules, createCampaignSchema, quoteCouponSchema, redeemCouponSchema } from './schemas'

describe('código', () => {
  it('normaliza caixa e espaço', () => {
    expect(normalizeCouponCode('  bem vindo10 ')).toBe('BEMVINDO10')
    expect(isValidCouponCode('AB')).toBe(false)
    expect(isValidCouponCode('VERAO-26')).toBe(true)
  })

  it('gera com prefixo, sem caracteres ambíguos', () => {
    let next = 0
    const code = generateCouponCode({ prefix: 'NATAL', randomInt: (max) => next++ % max })
    expect(code).toBe('NATAL-ABCDEFGH')
    for (let index = 0; index < 200; index += 1) {
      const generated = generateCouponCode({ randomInt: cryptoRandomInt })
      expect([...generated].every((character) => GENERATED_CODE_ALPHABET.includes(character))).toBe(true)
    }
  })
})

describe('contato canônico', () => {
  it('telefone com máscara, com e sem DDI, é o mesmo', () => {
    expect(canonicalPhone('(11) 98765-4321')).toBe('5511987654321')
    expect(canonicalPhone('+55 11 98765 4321')).toBe('5511987654321')
    expect(canonicalPhone('55 3222-1111')).toBe('555532221111')
    expect(canonicalPhone('123')).toBeUndefined()
  })

  it('e-mail minúsculo; inválido é undefined', () => {
    expect(canonicalEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com')
    expect(canonicalEmail('ana@')).toBeUndefined()
  })

  it('máscara de log mostra só o fim', () => {
    expect(maskPhone('5511987654321')).toBe('****4321')
  })
})

describe('regras da campanha', () => {
  const leadCapture = {
    enabled: true,
    fields: { name: 'optional' as const, phone: 'optional' as const, email: 'off' as const },
    consentText: '',
  }

  it('aponta todos os problemas de uma vez', () => {
    const issues = checkCampaignRules({
      startsAt: '2026-12-01T00:00:00Z',
      endsAt: '2026-11-01T00:00:00Z',
      codeMode: 'per-lead',
      isAutomatic: true,
      leadCapture,
    })
    expect(issues.map((issue) => issue.field)).toEqual([
      'endsAt',
      'leadCapture.fields',
      'leadCapture.consentText',
      'codeMode',
    ])
  })

  it('schema de criação aplica padrões e normaliza o código fixo', () => {
    const data = createCampaignSchema.parse({
      name: 'Inauguração',
      discount: { kind: 'percent', value: 10 },
      fixedCode: ' bem vindo ',
    })
    expect(data).toMatchObject({ codeMode: 'fixed', fixedCode: 'BEMVINDO', scope: { kind: 'all' }, isActive: false })
    expect(createCampaignSchema.safeParse({ name: 'x', discount: { kind: 'percent', value: 101 } }).success).toBe(false)
  })

  it('resgate exige código OU campanha, nunca os dois', () => {
    const base = { orderRef: { kind: 'order', id: '1' }, items: [] }
    expect(redeemCouponSchema.safeParse(base).success).toBe(false)
    expect(
      redeemCouponSchema.safeParse({ ...base, code: 'ABC', campaignId: '7f1c9a54-8d39-4a4e-9c0e-0f6f4e1d1a11' })
        .success,
    ).toBe(false)
    expect(redeemCouponSchema.safeParse({ ...base, code: 'abc' }).success).toBe(true)
  })
})

describe('desconto no schema', () => {
  it('teto zero é recusado (sem teto é null)', () => {
    expect(
      createCampaignSchema.safeParse({ name: 'x', discount: { kind: 'percent', value: 10, maxDiscountCents: 0 } })
        .success,
    ).toBe(false)
    expect(
      createCampaignSchema.safeParse({ name: 'x', discount: { kind: 'percent', value: 10, maxDiscountCents: null } })
        .success,
    ).toBe(true)
    expect(createCampaignSchema.safeParse({ name: 'x', discount: { kind: 'fixed', value: 0 } }).success).toBe(false)
  })
})

describe('automática com captação', () => {
  it('desconto automático e captação de contato juntos são permitidos', () => {
    const issues = checkCampaignRules({
      startsAt: null,
      endsAt: null,
      codeMode: 'fixed',
      isAutomatic: true,
      leadCapture: {
        enabled: true,
        fields: { name: 'optional', phone: 'required', email: 'off' },
        consentText: 'Aceito.',
      },
    })
    expect(issues).toEqual([])
  })

  it('etiqueta do lead: vazio vira null, limite de tamanho', () => {
    expect(
      createCampaignSchema.parse({ name: 'x', discount: { kind: 'percent', value: 5 }, leadTag: '  ' }).leadTag,
    ).toBeNull()
    expect(
      createCampaignSchema.parse({ name: 'x', discount: { kind: 'percent', value: 5 }, leadTag: ' vip ' }).leadTag,
    ).toBe('vip')
    expect(
      createCampaignSchema.safeParse({ name: 'x', discount: { kind: 'percent', value: 5 }, leadTag: 'x'.repeat(41) })
        .success,
    ).toBe(false)
  })

  it('cotação: código ou campanha; itens ou subtotal', () => {
    expect(quoteCouponSchema.safeParse({ code: 'ABC', subtotalCents: 1000 }).success).toBe(true)
    expect(quoteCouponSchema.safeParse({ code: 'ABC' }).success).toBe(false)
    expect(quoteCouponSchema.safeParse({ code: 'ABC', items: [], subtotalCents: 1 }).success).toBe(false)
  })
})
