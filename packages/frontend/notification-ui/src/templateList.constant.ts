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

/** Tamanhos de página oferecidos. 25 cabe numa tela sem empurrar o editor para fora dela. */
export const TEMPLATE_PAGE_SIZES = [10, 25, 50] as const
export const DEFAULT_TEMPLATE_PAGE_SIZE = 25

/**
 * Resumo de uma linha do corpo para a tabela e a lista.
 *
 * O corpo de um modelo de e-mail é o HTML inteiro: despejado na célula, a linha vira um parede de
 * marcação e a tabela deixa de servir para varrer. Aqui sai a marcação (e o que está dentro de
 * `<style>`/`<script>`/comentário), o espaço colapsa e o texto é cortado — o editor mostra o resto.
 */
export function summarizeTemplateBody(body: string, maxLength = 140): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
