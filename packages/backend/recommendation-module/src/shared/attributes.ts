/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os campos específicos do tipo, conferidos contra a definição do tipo.
 */

import {
  FIELD_TYPE,
  InvalidFieldValueError,
  UnknownFieldError,
  httpUrlSchema,
  type FieldDefinition,
  type KindDefinition,
} from '@adatechnology/recommendation-contracts'

function normalizeValue(field: FieldDefinition, value: unknown): unknown {
  switch (field.type) {
    case FIELD_TYPE.TEXT:
      if (typeof value !== 'string') throw new InvalidFieldValueError(field.name, 'esperado texto')
      if (value.length > 2000) throw new InvalidFieldValueError(field.name, 'texto longo demais')
      return value.trim()
    case FIELD_TYPE.NUMBER:
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new InvalidFieldValueError(field.name, 'esperado número')
      }
      return value
    case FIELD_TYPE.BOOLEAN:
      if (typeof value !== 'boolean') throw new InvalidFieldValueError(field.name, 'esperado verdadeiro ou falso')
      return value
    case FIELD_TYPE.SELECT:
      if (typeof value !== 'string' || !field.options?.some((option) => option.value === value)) {
        throw new InvalidFieldValueError(field.name, 'opção inexistente')
      }
      return value
    case FIELD_TYPE.URL:
      if (typeof value !== 'string' || !httpUrlSchema.safeParse(value).success) {
        throw new InvalidFieldValueError(field.name, 'esperado endereço http ou https')
      }
      return value
  }
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/**
 * Devolve os atributos normalizados. Campo vazio sai do objeto em vez de ficar gravado como `""`:
 * a tela trataria `""` e "não preenchido" de jeitos diferentes.
 *
 * `partial` é a edição: campo obrigatório ausente no PATCH não é erro, porque ele continua gravado.
 */
export function validateAttributes(params: {
  readonly kind: KindDefinition
  readonly attributes: Readonly<Record<string, unknown>>
  readonly partial?: boolean
}): Record<string, unknown> {
  const byName = new Map(params.kind.fields.map((field) => [field.name, field]))

  for (const name of Object.keys(params.attributes)) {
    if (!byName.has(name)) throw new UnknownFieldError(name)
  }

  const result: Record<string, unknown> = {}
  for (const field of params.kind.fields) {
    const value = params.attributes[field.name]
    if (isEmpty(value)) {
      if (field.required && !params.partial) throw new InvalidFieldValueError(field.name, 'obrigatório')
      continue
    }
    result[field.name] = normalizeValue(field, value)
  }

  return result
}
