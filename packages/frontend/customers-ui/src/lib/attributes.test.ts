/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { filterableFields, inputTypeFor, parseAttribute, validateAttributes } from './attributes'
import type { FieldDefinition } from '../providers/types'

const campo = (partial: Partial<FieldDefinition> & { name: string }): FieldDefinition => ({
  label: partial.name,
  type: 'text',
  required: false,
  ...partial,
})

describe('tipo de input', () => {
  it('dinheiro é TEXTO, não number — o input numérico não aceita vírgula', () => {
    expect(inputTypeFor(campo({ name: 'renda', type: 'money' }))).toBe('text')
  })

  it('os demais tipos mapeiam direto', () => {
    expect(inputTypeFor(campo({ name: 'idade', type: 'number' }))).toBe('number')
    expect(inputTypeFor(campo({ name: 'admissao', type: 'date' }))).toBe('date')
    expect(inputTypeFor(campo({ name: 'ativo', type: 'boolean' }))).toBe('checkbox')
  })
})

describe('leitura do que foi digitado', () => {
  it('aceita vírgula e ponto de milhar — o operador digita como o teclado manda', () => {
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '1.234,56')).toBe(1234.56)
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '1234.56')).toBe(1234.56)
  })

  it('o ponto vira milhar só quando o formato pede — senão `1234.56` viraria 123456', () => {
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '1.234')).toBe(1234)
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '1.234.567')).toBe(1234567)
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '0.5')).toBe(0.5)
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '1234.56')).toBe(1234.56)
  })

  it('campo vazio vira AUSENTE, nunca string vazia nem zero', () => {
    expect(parseAttribute(campo({ name: 'renda', type: 'money' }), '   ')).toBeUndefined()
    expect(parseAttribute(campo({ name: 'apelido' }), '')).toBeUndefined()
  })

  it('texto que não é número não vira zero', () => {
    expect(parseAttribute(campo({ name: 'renda', type: 'number' }), 'muito')).toBeUndefined()
  })
})

describe('validação contra o catálogo', () => {
  it('campo obrigatório vazio é apontado pelo RÓTULO, que é o que a pessoa leu na tela', () => {
    const errors = validateAttributes({
      fields: [campo({ name: 'renda_mensal', label: 'Renda mensal', required: true })],
      attributes: {},
    })

    expect(errors).toEqual([{ name: 'renda_mensal', label: 'Renda mensal', message: 'Campo obrigatório' }])
  })

  it('aponta TODOS os campos de uma vez, não o primeiro', () => {
    const errors = validateAttributes({
      fields: [campo({ name: 'a', label: 'A', required: true }), campo({ name: 'b', label: 'B', required: true })],
      attributes: {},
    })

    expect(errors.map((error) => error.name)).toEqual(['a', 'b'])
  })

  it('opção fora da lista declarada é recusada', () => {
    const errors = validateAttributes({
      fields: [campo({ name: 'porte', type: 'select', options: [{ value: 'mei', label: 'MEI' }] })],
      attributes: { porte: 'gigante' },
    })

    expect(errors[0]?.message).toBe('Opção inválida')
  })

  it('campo opcional em branco não gera erro', () => {
    expect(validateAttributes({ fields: [campo({ name: 'apelido' })], attributes: {} })).toEqual([])
  })
})

describe('campos filtráveis', () => {
  it('campo CIFRADO não entra no filtro — o servidor não compara o que não decifra', () => {
    const fields = [
      campo({ name: 'renda', filterable: true, encrypted: true }),
      campo({ name: 'cidade', filterable: true }),
      campo({ name: 'apelido' }),
    ]

    expect(filterableFields(fields).map((field) => field.name)).toEqual(['cidade'])
  })
})
