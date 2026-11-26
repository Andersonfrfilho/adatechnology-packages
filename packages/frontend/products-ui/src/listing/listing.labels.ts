export type ProductsListingLabels = {
  readonly search: string
  readonly catalog: string
  readonly section: string
  readonly availability: string
  readonly pricing: string
  readonly allOptions: string
  readonly selectedCount: (count: number) => string
  readonly noCatalog: string
  readonly noSection: string
  readonly availabilityActive: string
  readonly availabilityInactive: string
  readonly pricingOnRequest: string
  readonly pricingPriced: string
  readonly clearFilters: string
  readonly results: (total: number) => string
  readonly columnImage: string
  readonly columnName: string
  readonly columnCatalog: string
  readonly columnSection: string
  readonly columnPrice: string
  readonly columnAvailable: string
  readonly columnOrder: string
  readonly yes: string
  readonly no: string
  readonly priceOnRequest: string
  readonly sortAscending: string
  readonly sortDescending: string
  readonly sortNeutral: string
  readonly selectAll: string
  readonly selectRow: (name: string) => string
  readonly batchRegion: string
  readonly batchActivate: string
  readonly batchDeactivate: string
  readonly batchMove: string
  readonly batchMoveTarget: string
  readonly batchDelete: string
  readonly batchDeleteConfirm: (count: number) => string
  readonly batchConfirm: string
  readonly batchCancel: string
  readonly batchClear: string
  readonly batchPartialFailure: (failed: number) => string
  readonly empty: string
  readonly emptyFiltered: string
  readonly loading: string
  readonly paginationLabel: string
  readonly perPage: string
  readonly range: (first: number, last: number, total: number) => string
  readonly previousPage: string
  readonly nextPage: string
  readonly pageOf: (page: number, pageCount: number) => string
}

export const DEFAULT_PRODUCTS_LISTING_LABELS: ProductsListingLabels = {
  search: 'Buscar produto',
  catalog: 'Catálogo',
  section: 'Seção',
  availability: 'Disponibilidade',
  pricing: 'Preço',
  allOptions: 'Todos',
  selectedCount: (count) => (count === 1 ? '1 selecionado' : `${count} selecionados`),
  noCatalog: 'Sem catálogo',
  noSection: 'Sem seção',
  availabilityActive: 'Disponível',
  availabilityInactive: 'Indisponível',
  pricingOnRequest: 'Sob consulta',
  pricingPriced: 'Com preço',
  clearFilters: 'Limpar filtros',
  results: (total) => (total === 1 ? '1 resultado' : `${total} resultados`),
  columnImage: 'Img',
  columnName: 'Nome',
  columnCatalog: 'Catálogo',
  columnSection: 'Seção',
  columnPrice: 'Preço',
  columnAvailable: 'Disponível',
  columnOrder: 'Ordem',
  yes: 'Sim',
  no: 'Não',
  priceOnRequest: 'Sob consulta',
  sortAscending: 'ordenado de A a Z',
  sortDescending: 'ordenado de Z a A',
  sortNeutral: 'sem ordenação',
  selectAll: 'Selecionar todos desta página',
  selectRow: (name) => `Selecionar ${name}`,
  batchRegion: 'Ações em lote',
  batchActivate: 'Ativar',
  batchDeactivate: 'Desativar',
  batchMove: 'Mover de catálogo',
  batchMoveTarget: 'Catálogo de destino',
  batchDelete: 'Excluir',
  batchDeleteConfirm: (count) =>
    `Excluir ${count === 1 ? '1 produto' : `${count} produtos`}? A ação não pode ser desfeita.`,
  batchConfirm: 'Confirmar',
  batchCancel: 'Cancelar',
  batchClear: 'Limpar seleção',
  batchPartialFailure: (failed) =>
    failed === 1 ? 'Um produto não foi alterado.' : `${failed} produtos não foram alterados.`,
  empty: 'Nenhum produto cadastrado',
  emptyFiltered: 'Nenhum produto com esses filtros',
  loading: 'Carregando produtos',
  paginationLabel: 'Paginação',
  perPage: 'Por página',
  range: (first, last, total) => `Mostrando ${first}–${last} de ${total}`,
  previousPage: 'Anterior',
  nextPage: 'Próxima',
  pageOf: (page, pageCount) => `Página ${page} de ${pageCount}`,
}
