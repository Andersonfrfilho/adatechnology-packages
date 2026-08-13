/**
 * Textos da tela de catálogo. Todos sobrescrevíveis: o produto troca vocabulário ("produto" vira
 * "serviço", "catálogo" vira "cardápio") ou o idioma inteiro sem manter uma cópia da tela.
 */

export interface ProductsWorkspaceLabels {
  readonly title: string
  readonly search: string
  readonly newProduct: string
  readonly bulkImport: string
  readonly catalogsTab: string
  readonly productsTab: string
  readonly editTitle: string
  readonly createTitle: string
  readonly close: string
  readonly remove: string
  readonly removeConfirm: (name: string) => string
  readonly loadFailure: string
  readonly previousPage: string
  readonly nextPage: string
  readonly rangeOf: (page: number, totalPages: number, total: number) => string
}

export const DEFAULT_PRODUCTS_WORKSPACE_LABELS: ProductsWorkspaceLabels = {
  title: 'Catálogo',
  search: 'Buscar produto',
  newProduct: 'Novo produto',
  bulkImport: 'Importar CSV',
  catalogsTab: 'Catálogos',
  productsTab: 'Produtos',
  editTitle: 'Editar produto',
  createTitle: 'Novo produto',
  close: 'Fechar',
  remove: 'Excluir',
  removeConfirm: (name) => `Excluir "${name}"? A ação não pode ser desfeita.`,
  loadFailure: 'Não foi possível carregar os produtos',
  previousPage: 'Página anterior',
  nextPage: 'Próxima página',
  // "Página 1 de 0" parecia defeito quando a busca não achava nada.
  rangeOf: (page, totalPages, total) =>
    total === 0 ? 'Nenhum produto' : `Página ${page} de ${totalPages} · ${total} produto${total === 1 ? '' : 's'}`,
}
