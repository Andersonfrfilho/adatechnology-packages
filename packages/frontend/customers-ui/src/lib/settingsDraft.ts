/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As travas da página de configuração, puras e testáveis sem montar React.
 *
 * Elas repetem o que o servidor já cobra, e isso é de propósito: o servidor DECIDE, mas descobrir
 * "nome duplicado" depois de preencher cinco campos é a ida e volta que esta camada evita.
 */

import type { DocumentDefinition, FieldDefinition } from '../providers/types'

export const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,40}$/
export const MAX_FILTERABLE_FIELDS = 8

export type DraftError = { readonly path: string; readonly message: string }

export function validateSettingsDraft(draft: {
  readonly fieldCatalog: readonly FieldDefinition[]
  readonly documentCatalog: readonly DocumentDefinition[]
}): readonly DraftError[] {
  const errors: DraftError[] = []

  const named = [
    ...draft.fieldCatalog.map((field) => ({ kind: 'campo', name: field.name })),
    ...draft.documentCatalog.map((document) => ({ kind: 'documento', name: document.name })),
  ]

  for (const entry of named) {
    if (!FIELD_NAME_PATTERN.test(entry.name)) {
      errors.push({
        path: entry.name,
        message: `O nome do ${entry.kind} usa apenas letras minúsculas, números e _, começando por letra.`,
      })
    }
  }

  // Nome é CHAVE — do jsonb, da coluna de documento e do índice. Dois iguais fariam um sobrescrever
  // o outro em silêncio, e nenhuma tela mostraria qual venceu.
  const seen = new Set<string>()
  for (const entry of named) {
    if (seen.has(entry.name)) {
      errors.push({ path: entry.name, message: `Já existe um campo ou documento chamado "${entry.name}".` })
    }
    seen.add(entry.name)
  }

  for (const field of draft.fieldCatalog) {
    if (field.type === 'select' && (field.options ?? []).length === 0) {
      errors.push({ path: field.name, message: 'Campo de seleção precisa de ao menos uma opção.' })
    }

    // Cifrado não se compara: o índice guardaria texto cifrado, e a busca por "São Paulo" não
    // acharia nada — sem erro nenhum, que é o pior jeito de falhar.
    if (field.filterable && field.encrypted) {
      errors.push({ path: field.name, message: 'Campo cifrado não pode ser filtrável.' })
    }
  }

  const filterable = draft.fieldCatalog.filter((field) => field.filterable).length
  if (filterable > MAX_FILTERABLE_FIELDS) {
    errors.push({
      path: 'fieldCatalog',
      message: `No máximo ${MAX_FILTERABLE_FIELDS} campos filtráveis — cada um é um índice a manter na escrita.`,
    })
  }

  return errors
}

/**
 * O que a MUDANÇA quebra, e não o que o rascunho tem de errado. São perguntas diferentes: apagar um
 * campo é válido e destrutivo ao mesmo tempo, e o operador precisa confirmar antes, não descobrir
 * depois.
 */
export function describeDestructiveChanges(params: {
  readonly current: {
    readonly fieldCatalog: readonly FieldDefinition[]
    readonly documentCatalog: readonly DocumentDefinition[]
  }
  readonly draft: {
    readonly fieldCatalog: readonly FieldDefinition[]
    readonly documentCatalog: readonly DocumentDefinition[]
  }
}): readonly string[] {
  const warnings: string[] = []

  const draftFields = new Set(params.draft.fieldCatalog.map((field) => field.name))
  for (const field of params.current.fieldCatalog) {
    if (!draftFields.has(field.name)) {
      warnings.push(`O campo "${field.label}" some das fichas. O que já foi preenchido deixa de aparecer.`)
    }
  }

  const draftDocuments = new Set(params.draft.documentCatalog.map((document) => document.name))
  for (const document of params.current.documentCatalog) {
    if (!draftDocuments.has(document.name)) {
      warnings.push(`O documento "${document.label}" some das fichas.`)
    }
  }

  const currentTypes = new Map(params.current.fieldCatalog.map((field) => [field.name, field.type]))
  for (const field of params.draft.fieldCatalog) {
    const previous = currentTypes.get(field.name)
    if (previous && previous !== field.type) {
      warnings.push(`O campo "${field.label}" muda de tipo. O valor já gravado pode deixar de ser lido.`)
    }
  }

  const currentRequired = new Map(params.current.fieldCatalog.map((field) => [field.name, field.required]))
  for (const field of params.draft.fieldCatalog) {
    if (field.required && currentRequired.get(field.name) === false) {
      warnings.push(`"${field.label}" passa a ser obrigatório. Fichas antigas ficam incompletas.`)
    }
  }

  return warnings
}
