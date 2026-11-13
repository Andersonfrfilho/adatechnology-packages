/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As travas da página de configuração. Funções puras: o que elas decidem é conferível por leitura,
 * e testável sem banco.
 */

import {
  EncryptedFieldRemovalError,
  FieldTypeImmutableError,
  type DocumentDefinition,
  type FieldDefinition,
} from '@adatechnology/customer-contracts'

export type CatalogChange = {
  readonly current: readonly FieldDefinition[]
  readonly next: readonly FieldDefinition[]
}

/**
 * O que a tela pode e não pode mudar num catálogo já em uso.
 *
 * Não há regra sobre RENOMEAR: o `name` é a identidade da definição, então trocá-lo é remover uma e
 * criar outra — e é como remoção que a regra o pega. Quem quiser mudar o texto muda o `label`.
 */
export function assertCatalogChangeIsSafe(change: CatalogChange): void {
  const nextByName = new Map(change.next.map((field) => [field.name, field]))

  for (const field of change.current) {
    const updated = nextByName.get(field.name)

    /*
     * Campo cifrado sumindo do catálogo deixaria no banco um dado cifrado que ninguém mais sabe o
     * que é: nem a tela desenha, nem a decifra sabe qual chave usar. É perda silenciosa.
     */
    if (!updated && field.encrypted) throw new EncryptedFieldRemovalError(field.name)

    /*
     * Já existe valor gravado na forma antiga. Converter em massa é migration com plano de
     * rollback, não um clique numa tela de configuração.
     */
    if (updated && updated.type !== field.type) throw new FieldTypeImmutableError(field.name)
  }
}

/** Mesma regra para documento: cifrado não sai do catálogo pela tela. */
export function assertDocumentCatalogChangeIsSafe(params: {
  readonly current: readonly DocumentDefinition[]
  readonly next: readonly DocumentDefinition[]
  readonly encryptedDocuments: readonly string[]
}): void {
  const nextNames = new Set(params.next.map((document) => document.name))

  for (const document of params.current) {
    if (!nextNames.has(document.name) && params.encryptedDocuments.includes(document.name)) {
      throw new EncryptedFieldRemovalError(document.name)
    }
  }
}

/** Campos que passaram a exigir índice, e os que deixaram — o que a fila de DDL precisa saber. */
export function diffFilterableFields(change: CatalogChange): {
  readonly toCreate: readonly FieldDefinition[]
  readonly toDrop: readonly FieldDefinition[]
} {
  const wasFilterable = new Set(change.current.filter((f) => f.filterable).map((f) => f.name))
  const isFilterable = new Set(change.next.filter((f) => f.filterable).map((f) => f.name))

  return {
    toCreate: change.next.filter((f) => f.filterable && !wasFilterable.has(f.name)),
    toDrop: change.current.filter((f) => f.filterable && !isFilterable.has(f.name)),
  }
}

/** O cast do índice de expressão segue o `type` declarado — errado, o planejador ignora o índice. */
export function castForFieldType(type: FieldDefinition['type']): string {
  switch (type) {
    case 'number':
    case 'money':
      return 'numeric'
    case 'date':
      return 'date'
    case 'boolean':
      return 'boolean'
    default:
      return 'text'
  }
}
