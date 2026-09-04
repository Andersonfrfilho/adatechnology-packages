/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { EncryptedFieldRemovalError, FieldTypeImmutableError, type FieldDefinition } from '@adatechnology/customer-contracts'

import { assertCatalogChangeIsSafe, castForFieldType, diffFilterableFields } from './validateCatalogChange'
import { validateAttributes } from './validateAttributes'

function campo(over: Partial<FieldDefinition> = {}): FieldDefinition {
  return { name: 'renda', label: 'Renda', type: 'number', required: false, ...over }
}

describe('mudança de catálogo', () => {
  it('recusa remover campo cifrado — o dado continua no banco e ninguém saberia o que é', () => {
    expect(() => assertCatalogChangeIsSafe({ current: [campo({ encrypted: true })], next: [] })).toThrow(
      EncryptedFieldRemovalError,
    )
  })

  it('permite remover campo NÃO cifrado', () => {
    expect(() => assertCatalogChangeIsSafe({ current: [campo()], next: [] })).not.toThrow()
  })

  it('recusa trocar o tipo de campo em uso — converter em massa é migration, não clique', () => {
    expect(() => assertCatalogChangeIsSafe({ current: [campo()], next: [campo({ type: 'text' })] })).toThrow(
      FieldTypeImmutableError,
    )
  })

  it('permite trocar o rótulo, que é o que a tela mostra', () => {
    expect(() =>
      assertCatalogChangeIsSafe({ current: [campo()], next: [campo({ label: 'Renda mensal' })] }),
    ).not.toThrow()
  })
})

describe('diffFilterableFields — o que a fila de DDL precisa saber', () => {
  it('separa o que ganhou índice do que perdeu', () => {
    const diff = diffFilterableFields({
      current: [campo({ name: 'renda', filterable: true }), campo({ name: 'idade' })],
      next: [campo({ name: 'renda' }), campo({ name: 'idade', filterable: true })],
    })

    expect(diff.toCreate.map((f) => f.name)).toEqual(['idade'])
    expect(diff.toDrop.map((f) => f.name)).toEqual(['renda'])
  })

  it('não mexe no que já era filtrável', () => {
    const mesmo = [campo({ filterable: true })]

    expect(diffFilterableFields({ current: mesmo, next: mesmo })).toEqual({ toCreate: [], toDrop: [] })
  })
})

describe('castForFieldType — cast errado faz o planejador ignorar o índice', () => {
  it('mapeia cada tipo', () => {
    expect(castForFieldType('number')).toBe('numeric')
    expect(castForFieldType('money')).toBe('numeric')
    expect(castForFieldType('date')).toBe('date')
    expect(castForFieldType('boolean')).toBe('boolean')
    expect(castForFieldType('text')).toBe('text')
    expect(castForFieldType('select')).toBe('text')
  })
})

describe('validateAttributes — jsonb com forma, não sacola', () => {
  const catalog = [
    campo({ name: 'renda', type: 'money' }),
    campo({ name: 'estado_civil', type: 'select', options: [{ value: 'casado', label: 'Casado' }] }),
  ]

  it('recusa chave fora do catálogo', () => {
    expect(() => validateAttributes({ catalog, attributes: { inventado: 'x' } })).toThrow()
  })

  it('recusa valor do tipo errado', () => {
    expect(() => validateAttributes({ catalog, attributes: { renda: '5000' } })).toThrow()
    expect(() => validateAttributes({ catalog, attributes: { renda: 5000 } })).not.toThrow()
  })

  it('recusa opção fora da lista do `select`', () => {
    expect(() => validateAttributes({ catalog, attributes: { estado_civil: 'solteiro' } })).toThrow()
    expect(() => validateAttributes({ catalog, attributes: { estado_civil: 'casado' } })).not.toThrow()
  })

  it('exige o obrigatório e aceita o vazio do opcional', () => {
    const comObrigatorio = [campo({ name: 'renda', type: 'money', required: true })]

    expect(() => validateAttributes({ catalog: comObrigatorio, attributes: {} })).toThrow()
    expect(() => validateAttributes({ catalog, attributes: {} })).not.toThrow()
  })
})
