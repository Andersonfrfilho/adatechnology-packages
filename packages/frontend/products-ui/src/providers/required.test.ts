import { describe, expect, it } from 'bun:test'

import { PRODUCT_FIELD, PRODUCT_OPTIONAL_FIELD, isProductFieldRequired } from './types'

const NO_FIELDS: readonly never[] = []

describe('isProductFieldRequired', () => {
  it('nome e preço são exigidos mesmo sem configuração', () => {
    // Não é preferência do host: produto sem nome ou sem preço a API recusa de qualquer forma, e
    // deixar a tela aceitar só adia o 400.
    expect(isProductFieldRequired({ requiredFields: undefined, fields: NO_FIELDS, field: PRODUCT_FIELD.NAME })).toBe(
      true,
    )
    expect(isProductFieldRequired({ requiredFields: [], fields: NO_FIELDS, field: PRODUCT_FIELD.PRICE })).toBe(true)
  })

  it('campo de vertical só é exigido quando também está ligado', () => {
    const requiredFields = [PRODUCT_FIELD.BRAND]

    expect(
      isProductFieldRequired({ requiredFields, fields: [PRODUCT_OPTIONAL_FIELD.BRAND], field: PRODUCT_FIELD.BRAND }),
    ).toBe(true)
    // Exigir o que não se desenha travaria o salvamento num campo que o usuário não consegue ver.
    expect(isProductFieldRequired({ requiredFields, fields: NO_FIELDS, field: PRODUCT_FIELD.BRAND })).toBe(false)
  })

  it('campo do núcleo obedece a `requiredFields` sem depender de `fields`', () => {
    // Descrição não é campo de vertical: ela está sempre na tela, e por isso não precisa estar em
    // `fields` para poder ser exigida.
    expect(
      isProductFieldRequired({
        requiredFields: [PRODUCT_FIELD.DESCRIPTION],
        fields: NO_FIELDS,
        field: PRODUCT_FIELD.DESCRIPTION,
      }),
    ).toBe(true)
  })

  it('a tabela por campo declara obrigatório sem lista separada', () => {
    expect(
      isProductFieldRequired({
        requiredFields: undefined,
        fields: { brand: { required: true } },
        field: PRODUCT_FIELD.BRAND,
      }),
    ).toBe(true)
  })

  it('campo escondido na tabela por campo não é exigido nem quando pede', () => {
    expect(
      isProductFieldRequired({
        requiredFields: undefined,
        fields: { brand: { required: true, visible: false } },
        field: PRODUCT_FIELD.BRAND,
      }),
    ).toBe(false)
  })

  it('campo fora de `requiredFields` não é exigido', () => {
    expect(
      isProductFieldRequired({
        requiredFields: [PRODUCT_FIELD.BRAND],
        fields: [PRODUCT_OPTIONAL_FIELD.AISLE],
        field: PRODUCT_FIELD.AISLE,
      }),
    ).toBe(false)
  })
})
