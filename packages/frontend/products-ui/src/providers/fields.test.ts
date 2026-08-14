import { describe, expect, it } from 'bun:test'

import {
  PRODUCT_FIELD,
  PRODUCT_OPTIONAL_FIELD,
  PRODUCT_SURFACE,
  isProductFieldVisible,
  resolveProductFields,
} from './types'

describe('resolveProductFields', () => {
  it('lista simples vale para as duas superfícies', () => {
    // É a forma que todo host usa hoje. Se ela deixasse de valer nas duas, a configuração por
    // superfície teria quebrado quem não pediu nada.
    const fields = [PRODUCT_OPTIONAL_FIELD.BARCODE, PRODUCT_OPTIONAL_FIELD.INVENTORY]

    expect(resolveProductFields(fields, PRODUCT_SURFACE.FORM)).toEqual(fields)
    expect(resolveProductFields(fields, PRODUCT_SURFACE.LIST)).toEqual(fields)
  })

  it('objeto separa formulário de tabela', () => {
    const fields = {
      form: [PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS, PRODUCT_OPTIONAL_FIELD.BRAND],
      list: [PRODUCT_OPTIONAL_FIELD.BRAND],
    }

    expect(resolveProductFields(fields, PRODUCT_SURFACE.FORM)).toContain(
      PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS,
    )
    expect(resolveProductFields(fields, PRODUCT_SURFACE.LIST)).not.toContain(
      PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS,
    )
  })

  it('superfície ausente no objeto não desenha campo opcional nenhum', () => {
    // Vazio, e não "cai para a outra superfície": declarar só `form` é dizer que a tabela fica com
    // as colunas do núcleo, e herdar em silêncio devolveria colunas que o host não pediu.
    expect(resolveProductFields({ form: [PRODUCT_OPTIONAL_FIELD.UNIT] }, PRODUCT_SURFACE.LIST)).toEqual([])
  })

  it('tabela por campo: declarar o campo já o mostra', () => {
    // `{}` é a entrada mais comum — "mostra, do jeito padrão". Exigir `visible: true` faria toda
    // configuração começar com ruído.
    const fields = { brand: {}, aisle: { visible: { list: false } } }

    expect(resolveProductFields(fields, PRODUCT_SURFACE.LIST)).toEqual([PRODUCT_OPTIONAL_FIELD.BRAND])
    expect(resolveProductFields(fields, PRODUCT_SURFACE.FORM)).toEqual([
      PRODUCT_OPTIONAL_FIELD.BRAND,
      PRODUCT_OPTIONAL_FIELD.AISLE,
    ])
  })
})

describe('isProductFieldVisible', () => {
  it('campo do núcleo aparece sem ser declarado; campo de vertical não', () => {
    // Padrões opostos de propósito: descrição já estava na tela antes de existir configuração, e
    // marca em catálogo de serviços seria coluna vazia.
    const fields = { brand: {} }

    expect(isProductFieldVisible({ fields, field: PRODUCT_FIELD.DESCRIPTION, surface: PRODUCT_SURFACE.FORM })).toBe(
      true,
    )
    expect(isProductFieldVisible({ fields: [], field: PRODUCT_FIELD.BRAND, surface: PRODUCT_SURFACE.FORM })).toBe(false)
  })

  it('a tabela por campo esconde campo do núcleo', () => {
    expect(
      isProductFieldVisible({
        fields: { description: { visible: false } },
        field: PRODUCT_FIELD.DESCRIPTION,
        surface: PRODUCT_SURFACE.FORM,
      }),
    ).toBe(false)
  })

  it('nome e preço não se escondem', () => {
    // Não é teimosia da UI: sem eles a API recusa o produto, e a tela sem os campos não teria como
    // preencher o que ela mesma vai mandar.
    const fields = { name: { visible: false }, price: { visible: false } }

    expect(isProductFieldVisible({ fields, field: PRODUCT_FIELD.NAME, surface: PRODUCT_SURFACE.FORM })).toBe(true)
    expect(isProductFieldVisible({ fields, field: PRODUCT_FIELD.PRICE, surface: PRODUCT_SURFACE.LIST })).toBe(true)
  })
})
