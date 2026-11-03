/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InvalidFieldValueError, UnknownFieldError, type KindDefinition } from '@adatechnology/recommendation-contracts'

import { validateAttributes } from './attributes'

const place: KindDefinition = {
  name: 'place',
  label: 'Lugar',
  fields: [
    {
      name: 'category',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: [{ value: 'parque', label: 'Parque' }],
    },
    { name: 'free', label: 'Gratuito', type: 'boolean', required: false },
    { name: 'site', label: 'Site', type: 'url', required: false },
    { name: 'price', label: 'Preço médio', type: 'number', required: false },
  ],
}

describe('validateAttributes', () => {
  it('aceita os campos do tipo e descarta os vazios', () => {
    expect(validateAttributes({ kind: place, attributes: { category: 'parque', free: true, site: '' } })).toEqual({
      category: 'parque',
      free: true,
    })
  })

  it('recusa campo que o tipo não declara', () => {
    expect(() => validateAttributes({ kind: place, attributes: { category: 'parque', extra: 1 } })).toThrow(
      UnknownFieldError,
    )
  })

  it('recusa opção que não existe', () => {
    expect(() => validateAttributes({ kind: place, attributes: { category: 'praia' } })).toThrow(InvalidFieldValueError)
  })

  it('cobra o obrigatório na criação e não na edição parcial', () => {
    expect(() => validateAttributes({ kind: place, attributes: {} })).toThrow(InvalidFieldValueError)
    expect(validateAttributes({ kind: place, attributes: {}, partial: true })).toEqual({})
  })

  it('recusa link javascript: em campo de URL', () => {
    expect(() =>
      validateAttributes({ kind: place, attributes: { category: 'parque', site: 'javascript:alert(1)' } }),
    ).toThrow(InvalidFieldValueError)
  })

  it('recusa número que veio como texto', () => {
    expect(() => validateAttributes({ kind: place, attributes: { category: 'parque', price: '10' } })).toThrow(
      InvalidFieldValueError,
    )
  })
})
