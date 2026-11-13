/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que a ficha desenha vem do CATÁLOGO, não de um formulário escrito à mão. Esta é a tradução
 * entre a definição de campo e o que a tela precisa saber — e é pura, para poder ser testada sem
 * montar React.
 */

import { FIELD_TYPE, type FieldDefinition } from '../providers/types'

export type AttributeError = { readonly name: string; readonly label: string; readonly message: string }

/**
 * O tipo de `<input>` para um campo declarado. `money` cai em texto de propósito: `number` no
 * navegador aceita notação científica e rejeita vírgula, que é como se digita dinheiro em pt-BR.
 */
export function inputTypeFor(field: FieldDefinition): 'text' | 'number' | 'date' | 'checkbox' {
  switch (field.type) {
    case FIELD_TYPE.NUMBER:
      return 'number'
    case FIELD_TYPE.DATE:
      return 'date'
    case FIELD_TYPE.BOOLEAN:
      return 'checkbox'
    default:
      return 'text'
  }
}

/** O texto digitado vira o valor do tipo declarado. Campo vazio vira ausente, nunca `''` ou `0`. */
export function parseAttribute(field: FieldDefinition, raw: string | boolean): unknown {
  if (field.type === FIELD_TYPE.BOOLEAN) return Boolean(raw)
  if (typeof raw !== 'string' || raw.trim() === '') return undefined

  if (field.type === FIELD_TYPE.NUMBER || field.type === FIELD_TYPE.MONEY) {
    /*
     * O ponto é ambíguo e a string sozinha não resolve: `1.234` é mil duzentos e trinta e quatro
     * para quem digita em pt-BR e um vírgula dois para quem digita em en-US.
     *
     * A regra: com vírgula presente, todo ponto é milhar. Sem vírgula, um ponto seguido de
     * EXATAMENTE três dígitos é milhar; qualquer outro é decimal. Ela erra em `1.500` querendo
     * dizer um e meio — caso raro em dinheiro, e o operador vê o valor formatado antes de salvar.
     */
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/\.(?=\d{3}(?:\D|$))/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return raw
}

/**
 * Valida contra o catálogo ANTES de enviar. Não substitui a validação do servidor — que é a que
 * decide — mas evita a ida e volta que devolveria o mesmo "campo obrigatório" que já se sabe aqui.
 */
export function validateAttributes(params: {
  readonly fields: readonly FieldDefinition[]
  readonly attributes: Readonly<Record<string, unknown>>
}): readonly AttributeError[] {
  const errors: AttributeError[] = []

  for (const field of params.fields) {
    const value = params.attributes[field.name]

    if (field.required && (value === undefined || value === '' || value === null)) {
      errors.push({ name: field.name, label: field.label, message: 'Campo obrigatório' })
      continue
    }

    if (value === undefined || value === null) continue

    if (field.type === FIELD_TYPE.SELECT && !(field.options ?? []).some((option) => option.value === value)) {
      errors.push({ name: field.name, label: field.label, message: 'Opção inválida' })
    }

    if ((field.type === FIELD_TYPE.NUMBER || field.type === FIELD_TYPE.MONEY) && typeof value !== 'number') {
      errors.push({ name: field.name, label: field.label, message: 'Informe um número' })
    }
  }

  return errors
}

/** Campo cifrado não vai para filtro de busca: o servidor não sabe comparar o que não decifra. */
export function filterableFields(fields: readonly FieldDefinition[]): readonly FieldDefinition[] {
  return fields.filter((field) => field.filterable && !field.encrypted)
}
