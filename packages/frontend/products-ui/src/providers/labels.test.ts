import { describe, expect, it } from 'bun:test'

import {
  DEFAULT_PRODUCT_COLUMN_LABELS,
  DEFAULT_PRODUCT_FIELD_LABELS,
  PRODUCT_FIELD,
  PRODUCT_SURFACE,
  resolveProductLabel,
} from './types'

describe('resolveProductLabel', () => {
  it('sem configuração, cada superfície usa o seu padrão', () => {
    // O formulário fala por extenso e a coluna abrevia. Se as duas caíssem no mesmo texto, ou o
    // cabeçalho estouraria a largura ou o rótulo do campo viraria sigla.
    expect(
      resolveProductLabel({ labels: undefined, field: PRODUCT_FIELD.UNIT_SIZE, surface: PRODUCT_SURFACE.FORM }),
    ).toBe(DEFAULT_PRODUCT_FIELD_LABELS.unitSize)
    expect(
      resolveProductLabel({ labels: undefined, field: PRODUCT_FIELD.UNIT_SIZE, surface: PRODUCT_SURFACE.LIST }),
    ).toBe(DEFAULT_PRODUCT_COLUMN_LABELS.unitSize)
    expect(DEFAULT_PRODUCT_FIELD_LABELS.unitSize).not.toBe(DEFAULT_PRODUCT_COLUMN_LABELS.unitSize)
  })

  it('tabela simples renomeia nas duas superfícies', () => {
    const labels = { [PRODUCT_FIELD.AISLE]: 'Setor' }

    expect(resolveProductLabel({ labels, field: PRODUCT_FIELD.AISLE, surface: PRODUCT_SURFACE.FORM })).toBe('Setor')
    expect(resolveProductLabel({ labels, field: PRODUCT_FIELD.AISLE, surface: PRODUCT_SURFACE.LIST })).toBe('Setor')
  })

  it('objeto separa formulário de coluna e mantém o padrão de quem não foi declarado', () => {
    const labels = { form: { [PRODUCT_FIELD.AISLE]: 'Setor da loja' }, list: { [PRODUCT_FIELD.AISLE]: 'Setor' } }

    expect(resolveProductLabel({ labels, field: PRODUCT_FIELD.AISLE, surface: PRODUCT_SURFACE.FORM })).toBe(
      'Setor da loja',
    )
    expect(resolveProductLabel({ labels, field: PRODUCT_FIELD.AISLE, surface: PRODUCT_SURFACE.LIST })).toBe('Setor')
    expect(resolveProductLabel({ labels, field: PRODUCT_FIELD.BRAND, surface: PRODUCT_SURFACE.FORM })).toBe(
      DEFAULT_PRODUCT_FIELD_LABELS.brand,
    )
  })

  it('rótulo da tabela por campo ganha de `labels`', () => {
    // Quem configurou o campo inteiro num lugar só não espera uma tabela separada sobrescrevendo
    // por baixo.
    const label = resolveProductLabel({
      labels: { [PRODUCT_FIELD.BRAND]: 'Fabricante' },
      fields: { brand: { label: 'Marca própria' } },
      field: PRODUCT_FIELD.BRAND,
      surface: PRODUCT_SURFACE.FORM,
    })

    expect(label).toBe('Marca própria')
  })
})
