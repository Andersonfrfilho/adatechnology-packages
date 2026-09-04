/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O `name` de um campo entra em DDL (`CREATE INDEX ... ((attributes->>'nome'))`), e o valor vem de
 * um formulário. Estes testes são a trava de segurança, não estilo.
 */

import { describe, expect, it } from 'bun:test'

import {
  createCustomerSchema,
  customerPhoneInputSchema,
  fieldDefinitionSchema,
  updateSettingsSchema,
} from './schemas'
import { FIELD_TYPE, MAX_FILTERABLE_FIELDS } from './settings.types'

function campo(overrides: Record<string, unknown> = {}) {
  return { name: 'renda_mensal', label: 'Renda mensal', type: FIELD_TYPE.NUMBER, required: false, ...overrides }
}

describe('fieldDefinitionSchema — `name` vai para dentro de DDL', () => {
  it('aceita a forma segura', () => {
    expect(fieldDefinitionSchema.parse(campo()).name).toBe('renda_mensal')
  })

  it('recusa tentativa de injeção', () => {
    for (const nome of ['renda"; DROP TABLE customers; --', "a') OR 1=1 --", 'renda mensal', 'Renda', '1renda', '']) {
      expect(fieldDefinitionSchema.safeParse(campo({ name: nome })).success).toBe(false)
    }
  })

  it('recusa `select` sem opção — a tela desenharia um campo impossível de preencher', () => {
    expect(fieldDefinitionSchema.safeParse(campo({ type: FIELD_TYPE.SELECT })).success).toBe(false)
    expect(
      fieldDefinitionSchema.safeParse(
        campo({ type: FIELD_TYPE.SELECT, options: [{ value: 'casado', label: 'Casado' }] }),
      ).success,
    ).toBe(true)
  })

  it('recusa cifrado E filtrável: o índice compararia texto cifrado e nunca acharia nada', () => {
    expect(fieldDefinitionSchema.safeParse(campo({ encrypted: true, filterable: true })).success).toBe(false)
    expect(fieldDefinitionSchema.safeParse(campo({ encrypted: true })).success).toBe(true)
  })
})

describe('updateSettingsSchema', () => {
  const base = { maskPhoneInList: true, documentCatalog: [] }

  it(`recusa mais de ${MAX_FILTERABLE_FIELDS} campos filtráveis — cada um cobra escrita a cada mensagem`, () => {
    const filtraveis = Array.from({ length: MAX_FILTERABLE_FIELDS + 1 }, (_, i) =>
      campo({ name: `campo_${i}`, filterable: true }),
    )

    expect(updateSettingsSchema.safeParse({ ...base, fieldCatalog: filtraveis }).success).toBe(false)
    expect(updateSettingsSchema.safeParse({ ...base, fieldCatalog: filtraveis.slice(1) }).success).toBe(true)
  })

  it('recusa `name` repetido — o segundo sobrescreveria o primeiro em silêncio', () => {
    const repetido = [campo({ name: 'origem' }), campo({ name: 'origem', label: 'Outra' })]

    expect(updateSettingsSchema.safeParse({ ...base, fieldCatalog: repetido }).success).toBe(false)
  })

  it('não conta campo não-filtrável no teto', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => campo({ name: `campo_${i}` }))

    expect(updateSettingsSchema.safeParse({ ...base, fieldCatalog: muitos }).success).toBe(true)
  })
})

describe('telefone', () => {
  it('exige dígitos crus — máscara vira dois clientes para a mesma pessoa', () => {
    expect(customerPhoneInputSchema.safeParse({ number: '5516993056772' }).success).toBe(true)
    expect(customerPhoneInputSchema.safeParse({ number: '(16) 99305-6772' }).success).toBe(false)
  })

  it('nasce sem marcação: quem decide o WhatsApp é o use-case, não o payload', () => {
    expect(customerPhoneInputSchema.parse({ number: '5516993056772' }).isWhatsApp).toBe(false)
  })
})

describe('createCustomerSchema', () => {
  it('aceita cliente sem nome — o fluxo cria a ficha antes de perguntar como a pessoa se chama', () => {
    const cliente = createCustomerSchema.parse({ phones: [{ number: '5516993056772', isWhatsApp: true }] })

    expect(cliente.name).toBeUndefined()
    expect(cliente.attributes).toEqual({})
  })
})
