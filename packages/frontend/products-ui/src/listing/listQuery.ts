import {
  PRODUCT_SORT_FIELD,
  type ListProductsParams,
  type ProductSortField,
  type SortDirection,
} from '../providers/types'
import {
  PRODUCT_AVAILABILITY_FILTER,
  PRODUCT_PRICING_FILTER,
  PRODUCTS_DEFAULT_PER_PAGE,
  PRODUCTS_PER_PAGE_OPTIONS,
  type ProductsListQuery,
} from './listing.types'

export const DEFAULT_PRODUCTS_LIST_QUERY: ProductsListQuery = {
  search: '',
  catalogIds: [],
  sectionIds: [],
  availability: [],
  pricing: [],
  sortDirection: 'asc',
  page: 1,
  perPage: PRODUCTS_DEFAULT_PER_PAGE,
}

/** Chaves usadas por `serializeProductsListQuery` — o host as passa ao seu hook de query string. */
export const PRODUCTS_LIST_QUERY_KEYS = [
  'q',
  'catalogs',
  'sections',
  'availability',
  'pricing',
  'sortBy',
  'sortDirection',
  'page',
  'perPage',
] as const
export type ProductsListQueryKey = (typeof PRODUCTS_LIST_QUERY_KEYS)[number]

const SORT_FIELDS: readonly string[] = Object.values(PRODUCT_SORT_FIELD)

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').filter((item) => item !== '')
}

/** Lê o que o host guardou na URL; valor desconhecido cai no padrão, nunca quebra a tela. */
export function parseProductsListQuery(values: Partial<Record<ProductsListQueryKey, string>>): ProductsListQuery {
  const sortBy = SORT_FIELDS.includes(values.sortBy ?? '') ? (values.sortBy as ProductSortField) : undefined
  const perPage = Number(values.perPage)
  return {
    search: values.q ?? '',
    catalogIds: splitList(values.catalogs),
    sectionIds: splitList(values.sections),
    availability: splitList(values.availability).filter((item) =>
      Object.values(PRODUCT_AVAILABILITY_FILTER).some((known) => known === item),
    ),
    pricing: splitList(values.pricing).filter((item) =>
      Object.values(PRODUCT_PRICING_FILTER).some((known) => known === item),
    ),
    ...(sortBy ? { sortBy } : {}),
    sortDirection: values.sortDirection === 'desc' ? 'desc' : 'asc',
    page: Math.max(Number.parseInt(values.page ?? '', 10) || 1, 1),
    perPage: (PRODUCTS_PER_PAGE_OPTIONS as readonly number[]).includes(perPage) ? perPage : PRODUCTS_DEFAULT_PER_PAGE,
  }
}

/** Valor padrão vira string vazia: o host apaga a chave e a URL fica limpa. */
export function serializeProductsListQuery(query: ProductsListQuery): Record<ProductsListQueryKey, string> {
  return {
    q: query.search,
    catalogs: query.catalogIds.join(','),
    sections: query.sectionIds.join(','),
    availability: query.availability.join(','),
    pricing: query.pricing.join(','),
    sortBy: query.sortBy ?? '',
    sortDirection: query.sortBy && query.sortDirection === 'desc' ? 'desc' : '',
    page: query.page > 1 ? String(query.page) : '',
    perPage: query.perPage === PRODUCTS_DEFAULT_PER_PAGE ? '' : String(query.perPage),
  }
}

/** Há algo a limpar? Página e itens por página não contam: não são filtro. */
export function hasActiveListFilters(query: ProductsListQuery): boolean {
  return (
    query.search !== '' ||
    query.catalogIds.length > 0 ||
    query.sectionIds.length > 0 ||
    query.availability.length > 0 ||
    query.pricing.length > 0 ||
    query.sortBy !== undefined
  )
}

export function clearListFilters(query: ProductsListQuery): ProductsListQuery {
  return { ...DEFAULT_PRODUCTS_LIST_QUERY, perPage: query.perPage }
}

/** Neutro → crescente → decrescente → neutro. */
export function nextSort(
  query: ProductsListQuery,
  field: ProductSortField,
): Pick<ProductsListQuery, 'sortBy' | 'sortDirection'> {
  if (query.sortBy !== field) return { sortBy: field, sortDirection: 'asc' }
  if (query.sortDirection === 'asc') return { sortBy: field, sortDirection: 'desc' }
  return { sortDirection: 'asc' }
}

/** Marcar as duas opções de um filtro binário equivale a não filtrar. */
function singleChoice<TValue extends string>(
  values: readonly string[],
  first: TValue,
  second: TValue,
): TValue | undefined {
  if (values.length !== 1) return undefined
  return values[0] === first ? first : values[0] === second ? second : undefined
}

export function toListProductsParams(query: ProductsListQuery): ListProductsParams {
  const availability = singleChoice(
    query.availability,
    PRODUCT_AVAILABILITY_FILTER.ACTIVE,
    PRODUCT_AVAILABILITY_FILTER.INACTIVE,
  )
  const pricing = singleChoice(query.pricing, PRODUCT_PRICING_FILTER.ON_REQUEST, PRODUCT_PRICING_FILTER.PRICED)
  const search = query.search.trim()
  return {
    page: query.page,
    pageSize: query.perPage,
    ...(search ? { search } : {}),
    ...(query.catalogIds.length ? { catalogIds: query.catalogIds } : {}),
    ...(query.sectionIds.length ? { sectionIds: query.sectionIds } : {}),
    ...(availability ? { active: availability === PRODUCT_AVAILABILITY_FILTER.ACTIVE } : {}),
    ...(pricing ? { priceOnRequest: pricing === PRODUCT_PRICING_FILTER.ON_REQUEST } : {}),
    ...(query.sortBy ? { sortBy: query.sortBy, sortDirection: query.sortDirection } : {}),
  }
}

export function sortDirectionOf(query: ProductsListQuery, field: ProductSortField): SortDirection | undefined {
  return query.sortBy === field ? query.sortDirection : undefined
}
