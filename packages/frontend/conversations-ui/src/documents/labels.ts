/**
 * Vocabulário da biblioteca de arquivos. Sobrescrevível campo a campo: o produto troca "cliente"
 * por "lead" ou o idioma inteiro sem manter uma cópia da tela para isso.
 */

export interface DocumentsWorkspaceLabels {
  readonly title: string
  readonly subtitle: (total: number) => string
  readonly searchPlaceholder: string
  readonly empty: string
  readonly noResults: string
  readonly loading: string
  readonly failure: string
  readonly view: string
  readonly download: string
  readonly remove: string
  readonly removeConfirm: (filename: string) => string
  readonly openConversation: string
  readonly sourceFilter: string
  readonly categoryFilter: string
  readonly startDate: string
  readonly endDate: string
  readonly clearFilters: string
  readonly selectAllPage: string
  readonly selectRow: string
  readonly bulkSelected: (count: number) => string
  readonly bulkClear: string
  readonly bulkDownloadZip: string
  readonly bulkRemove: (count: number) => string
  readonly bulkRemoveConfirm: (count: number) => string
  readonly columnFilename: string
  readonly columnContact: string
  readonly columnType: string
  readonly columnSize: string
  readonly columnSource: string
  readonly columnDate: string
  readonly columnActions: string
  readonly sourceLabels: Readonly<Record<string, string>>
  readonly categoryLabels: Readonly<Record<string, string>>
  readonly show: string
  readonly perPage: string
  readonly total: (count: number) => string
  readonly page: (current: number, last: number) => string
  readonly previousPage: string
  readonly nextPage: string
}

export const DEFAULT_DOCUMENTS_WORKSPACE_LABELS: DocumentsWorkspaceLabels = {
  title: 'Documentos',
  subtitle: (total) => `${total} arquivo${total === 1 ? '' : 's'} trocado${total === 1 ? '' : 's'}`,
  searchPlaceholder: 'Buscar por nome do arquivo ou telefone',
  empty: 'Nenhum arquivo trocado ainda.',
  noResults: 'Nenhum arquivo encontrado para os filtros aplicados.',
  loading: 'Carregando arquivos…',
  failure: 'Não foi possível carregar os arquivos.',
  view: 'Visualizar',
  download: 'Baixar',
  remove: 'Excluir',
  removeConfirm: (filename) => `Excluir "${filename}"?`,
  openConversation: 'Abrir conversa',
  sourceFilter: 'Origem',
  categoryFilter: 'Tipo',
  startDate: 'De',
  endDate: 'Até',
  clearFilters: 'Limpar filtros',
  selectAllPage: 'Selecionar todos desta página',
  selectRow: 'Selecionar arquivo',
  bulkSelected: (count) => `${count} selecionado${count === 1 ? '' : 's'}`,
  bulkClear: 'Limpar seleção',
  bulkDownloadZip: 'Baixar em zip',
  bulkRemove: (count) => `Excluir ${count}`,
  bulkRemoveConfirm: (count) => `Excluir ${count} arquivo${count === 1 ? '' : 's'}?`,
  columnFilename: 'Arquivo',
  columnContact: 'Contato',
  columnType: 'Tipo',
  columnSize: 'Tamanho',
  columnSource: 'Origem',
  columnDate: 'Recebido em',
  columnActions: 'Ações',
  sourceLabels: { customer: 'Cliente', agent: 'Atendente', bot: 'Bot' },
  categoryLabels: { document: 'Documento', image: 'Imagem', audio: 'Áudio', video: 'Vídeo' },
  show: 'Mostrar',
  perPage: 'por página',
  total: (count) => `${count} no total`,
  page: (current, last) => `${current} / ${last}`,
  previousPage: 'Página anterior',
  nextPage: 'Próxima página',
}
