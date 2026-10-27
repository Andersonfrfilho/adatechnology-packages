/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `attributes` é jsonb, mas não é sacola: tudo que entra é conferido contra o catálogo declarado.
 * Sem isto, o pacote guardaria chave que nenhuma tela sabe desenhar e valor que nenhuma consulta
 * sabe comparar — que é a má fama que jsonb tem, e é merecida quando ninguém valida.
 */

import {
  InvalidFieldValueError,
  UnknownFieldError,
  type FieldDefinition,
} from '@adatechnology/customer-contracts'

function isValidForType(field: FieldDefinition, value: unknown): boolean {
  switch (field.type) {
    case 'number':
    case 'money':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'date':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    case 'select':
      return typeof value === 'string' && (field.options ?? []).some((option) => option.value === value)
    default:
      return typeof value === 'string'
  }
}

export function validateAttributes(params: {
  readonly catalog: readonly FieldDefinition[]
  readonly attributes: Readonly<Record<string, unknown>>
}): void {
  const byName = new Map(params.catalog.map((field) => [field.name, field]))

  for (const [name, value] of Object.entries(params.attributes)) {
    const field = byName.get(name)
    if (!field) throw new UnknownFieldError(name)

    // Nulo é "não preenchido", e só o obrigatório reclama disso — a checagem vem depois.
    if (value === null || value === undefined) continue

    if (!isValidForType(field, value)) {
      throw new InvalidFieldValueError(name, `esperado ${field.type}`)
    }
  }

  for (const field of params.catalog) {
    if (!field.required) continue
    const value = params.attributes[field.name]
    if (value === undefined || value === null || value === '') {
      throw new InvalidFieldValueError(field.name, 'obrigatório')
    }
  }
}
