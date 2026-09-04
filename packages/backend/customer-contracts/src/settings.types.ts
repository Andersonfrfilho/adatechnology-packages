/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os dois catálogos que a instalação declara, e a configuração de boot.
 *
 * A separação entre os dois tipos de configuração é deliberada: o que é ESTRUTURAL (tenancy, o que
 * é cifrado, exclusão lógica) fica em código e não vai para tela nenhuma — trocar em execução
 * deixaria linhas cifradas e em claro na mesma coluna, sem nada dizendo qual é qual. O que é de
 * OPERAÇÃO (os catálogos, a máscara) é dado, editável, e muda sem deploy.
 */

export const FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  MONEY: 'money',
  BOOLEAN: 'boolean',
  SELECT: 'select',
} as const

export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE]

export const DOCUMENT_VALIDATOR = {
  CPF: 'cpf',
  CNPJ: 'cnpj',
  NONE: 'none',
} as const

export type DocumentValidator = (typeof DOCUMENT_VALIDATOR)[keyof typeof DOCUMENT_VALIDATOR]

/**
 * Teto de campos com índice de expressão.
 *
 * Todo índice cobra INSERT e UPDATE, e `upsertByPhone` escreve a CADA mensagem recebida. Sem teto,
 * a conversa passaria a pagar por relatórios que ninguém abre. Oito é folgado para operação e
 * apertado o bastante para a conta não virar.
 */
export const MAX_FILTERABLE_FIELDS = 8

/**
 * O `name` entra em DDL (`CREATE INDEX ... ((attributes->>'nome'))`), então esta forma é uma trava
 * de segurança, não estilo: sem ela, a página de configuração seria um console de SQL com outro nome.
 */
export const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,40}$/

export type DocumentDefinition = {
  /** Chave estável e imutável depois de criada. */
  readonly name: string
  readonly label: string
  readonly required: boolean
  /** Máscara de exibição, quando houver: `###.###.###-##`. */
  readonly mask?: string
  readonly validator: DocumentValidator
}

export type FieldDefinition = {
  readonly name: string
  readonly label: string
  readonly type: FieldType
  /** Obrigatório quando `type` é `select`; ignorado nos demais. */
  readonly options?: readonly { readonly value: string; readonly label: string }[]
  readonly required: boolean
  /** Cifrado em repouso pela chave do host. Uma vez cifrado, não sai do catálogo pela tela. */
  readonly encrypted?: boolean
  /** Entra no `search_vector`. Não custa DDL. */
  readonly searchable?: boolean
  /** Ganha índice de expressão para faixa e ordenação. Custa DDL e escrita — conta no teto. */
  readonly filterable?: boolean
}

export type CustomerSettings = {
  readonly companyId?: string
  /** Telefone mascarado na LISTAGEM. A ficha mostra inteiro a quem tem escopo. Padrão protege. */
  readonly maskPhoneInList: boolean
  readonly documentCatalog: readonly DocumentDefinition[]
  readonly fieldCatalog: readonly FieldDefinition[]
  readonly updatedAt: Date
  readonly updatedByUserId?: string
}

export type TenancyConfig = { readonly mode: 'single' } | { readonly mode: 'multi' }

/** Configuração de BOOT — estrutural, imutável em execução. Não vai para tela. */
export type CustomerModuleConfig = {
  readonly tenancy: TenancyConfig
  /** Documentos cifrados em repouso, por `name`. */
  readonly encryptedDocuments?: readonly string[]
  /** Exclusão lógica. Ausente = remoção física. */
  readonly softDelete?: boolean
}
