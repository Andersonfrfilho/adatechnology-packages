/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Modos de exibição e ordenação da lista de mensagens.
 *
 * Duas leituras da mesma coleção: a TABELA compara (canal e versão alinhados em coluna, varredura
 * vertical) e a LISTA reconhece (o texto da mensagem visível em duas linhas). Quem administra trinta
 * templates quer a tabela; quem procura "aquela que fala de senha" quer a lista.
 */

export const TEMPLATE_VIEWS = {
  TABLE: 'table',
  LIST: 'list',
} as const
export type TemplateView = (typeof TEMPLATE_VIEWS)[keyof typeof TEMPLATE_VIEWS]

/** As colunas ordenáveis da tabela — e só elas: cabeçalho clicável que não ordena é mentira. */
export const TEMPLATE_SORT_FIELDS = {
  KEY: 'key',
  CHANNEL: 'channel',
  VERSION: 'version',
} as const
export type TemplateSortField = (typeof TEMPLATE_SORT_FIELDS)[keyof typeof TEMPLATE_SORT_FIELDS]

export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
} as const
export type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS]

export type TemplateSort = {
  readonly field: TemplateSortField
  readonly direction: SortDirection
}

/**
 * As colunas da tabela, na ordem. `field` ausente = coluna que não ordena (texto livre e ações):
 * cabeçalho clicável que não reordena nada é promessa quebrada.
 */
export type TemplateColumn = {
  readonly labelKey: string
  readonly field?: TemplateSortField
  /** Cabeçalho só para leitor de tela — a coluna de ação não precisa de título visível. */
  readonly headerHidden?: boolean
}

export const TEMPLATE_COLUMNS: readonly TemplateColumn[] = [
  { labelKey: 'settings.column.key', field: TEMPLATE_SORT_FIELDS.KEY },
  { labelKey: 'settings.column.body' },
  { labelKey: 'settings.column.channel', field: TEMPLATE_SORT_FIELDS.CHANNEL },
  { labelKey: 'settings.column.version', field: TEMPLATE_SORT_FIELDS.VERSION },
  { labelKey: 'settings.column.actions', headerHidden: true },
]
