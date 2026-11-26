import { describe, expect, it } from 'bun:test'

import {
  DEFAULT_PRODUCTS_LIST_QUERY,
  clearListFilters,
  hasActiveListFilters,
  nextSort,
  parseProductsListQuery,
  serializeProductsListQuery,
  toListProductsParams,
} from './listQuery'

describe('listQuery', () => {
  it('ida e volta pela query string preserva filtros, ordem e página', () => {
    const query = {
      ...DEFAULT_PRODUCTS_LIST_QUERY,
      search: 'suco',
      catalogIds: ['a', 'none'],
      availability: ['active'],
      sortBy: 'price' as const,
      sortDirection: 'desc' as const,
      page: 3,
      perPage: 50,
    }
    expect(parseProductsListQuery(serializeProductsListQuery(query))).toEqual(query)
  })

  it('o padrão serializa tudo vazio, para a URL ficar limpa', () => {
    expect(Object.values(serializeProductsListQuery(DEFAULT_PRODUCTS_LIST_QUERY)).every((value) => value === '')).toBe(
      true,
    )
  })

  it('valor desconhecido na URL cai no padrão', () => {
    const parsed = parseProductsListQuery({ sortBy: 'drop table', perPage: '7', page: '-4', availability: 'x,active' })
    expect(parsed.sortBy).toBeUndefined()
    expect(parsed.perPage).toBe(20)
    expect(parsed.page).toBe(1)
    expect(parsed.availability).toEqual(['active'])
  })

  it('ordem alterna neutro → asc → desc → neutro', () => {
    const asc = { ...DEFAULT_PRODUCTS_LIST_QUERY, ...nextSort(DEFAULT_PRODUCTS_LIST_QUERY, 'name') }
    expect(asc).toMatchObject({ sortBy: 'name', sortDirection: 'asc' })
    const desc = { ...asc, ...nextSort(asc, 'name') }
    expect(desc).toMatchObject({ sortBy: 'name', sortDirection: 'desc' })
    expect(nextSort(desc, 'name').sortBy).toBeUndefined()
    expect(nextSort(desc, 'price')).toEqual({ sortBy: 'price', sortDirection: 'asc' })
  })

  it('"limpar filtros" só aparece com filtro ou ordem; página e itens por página não contam', () => {
    expect(hasActiveListFilters({ ...DEFAULT_PRODUCTS_LIST_QUERY, page: 4, perPage: 50 })).toBe(false)
    expect(hasActiveListFilters({ ...DEFAULT_PRODUCTS_LIST_QUERY, sortBy: 'name' })).toBe(true)
    expect(clearListFilters({ ...DEFAULT_PRODUCTS_LIST_QUERY, search: 'x', perPage: 50 }).perPage).toBe(50)
  })

  it('para a API: marcar as duas opções de um filtro binário não filtra; uma só filtra', () => {
    expect(
      toListProductsParams({ ...DEFAULT_PRODUCTS_LIST_QUERY, availability: ['active', 'inactive'] }),
    ).not.toHaveProperty('active')
    expect(toListProductsParams({ ...DEFAULT_PRODUCTS_LIST_QUERY, availability: ['inactive'] }).active).toBe(false)
    expect(toListProductsParams({ ...DEFAULT_PRODUCTS_LIST_QUERY, pricing: ['onRequest'] }).priceOnRequest).toBe(true)
    expect(toListProductsParams({ ...DEFAULT_PRODUCTS_LIST_QUERY, search: '  ', perPage: 10 })).toEqual({
      page: 1,
      pageSize: 10,
    })
  })
})
