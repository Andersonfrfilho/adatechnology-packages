import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useProducts } from '../providers/ProductsProvider'
import { CATALOG_NONE } from '../CatalogList'
import type { Catalog, CreateProductInput, Product, UpdateProductInput } from '../providers/types'
import { DEFAULT_PRODUCTS_LIST_QUERY, toListProductsParams } from '../listing/listQuery'
import type { ProductsListQuery, ProductsListingOptions } from '../listing/listing.types'

const SEARCH_DEBOUNCE_MS = 300

// `undefined` = nada aberto; `null` = formulário de criação; produto = edição daquele item.
export type ProductDraft = Product | null | undefined

export type ProductsWorkspaceState = {
  readonly products: readonly Product[]
  readonly catalogs: readonly Catalog[]
  readonly loading: boolean
  readonly error: string | undefined
  readonly page: number
  readonly totalPages: number
  readonly total: number
  readonly search: string
  readonly catalogId: string | null
  readonly draft: ProductDraft
  /** Estado da listagem em tabela (busca, filtros, ordem, página). Só é usado com `listing`. */
  readonly listQuery: ProductsListQuery
  /** Mudar filtro, busca ou ordem volta para a página 1; mudar só `page` ou `perPage` não. */
  readonly setListQuery: (patch: Partial<ProductsListQuery>) => void
  readonly setSearch: (value: string) => void
  readonly setCatalogId: (value: string | null) => void
  readonly setPage: (value: number) => void
  readonly openDraft: (draft: Product | null) => void
  readonly closeDraft: () => void
  readonly submitDraft: (input: CreateProductInput & UpdateProductInput) => Promise<void>
  readonly removeDraft: () => Promise<void>
  readonly reload: () => void
}

// A listagem é do servidor, não do cliente: busca, filtro por catálogo e página vão para a API
// porque a base cresce além do que cabe numa resposta. Filtrar em memória mostraria "nenhum
// produto" para um item que existe na página seguinte.
export function useProductsWorkspace(listing?: ProductsListingOptions): ProductsWorkspaceState {
  const api = useProducts()
  const isListing = listing !== undefined
  const controlledQuery = listing?.query
  const onListQueryChange = listing?.onQueryChange
  const [internalQuery, setInternalQuery] = useState<ProductsListQuery>(DEFAULT_PRODUCTS_LIST_QUERY)
  const listQuery = controlledQuery ?? internalQuery

  const [products, setProducts] = useState<readonly Product[]>([])
  const [catalogs, setCatalogs] = useState<readonly Catalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [catalogId, setCatalogIdValue] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(undefined)
  const [reloadToken, setReloadToken] = useState(0)

  const requestRef = useRef(0)

  const searchText = isListing ? listQuery.search : search
  // A busca digitada não entra na chave: ela só dispara a consulta depois do debounce.
  const listRequestKey = JSON.stringify({ ...listQuery, search: '' })
  const listQueryRef = useRef(listQuery)
  listQueryRef.current = listQuery

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  useEffect(() => {
    let active = true
    api
      .listCatalogs()
      .then((result) => {
        if (active) setCatalogs(result.data)
      })
      .catch(() => {
        if (active) setCatalogs([])
      })
    return () => {
      active = false
    }
  }, [api, reloadToken])

  useEffect(() => {
    // O contador descarta resposta de busca antiga: sem ele, digitar rápido deixa na tela o
    // resultado da consulta que voltou por último, que não é a mais recente.
    const requestId = ++requestRef.current
    setLoading(true)

    const params = isListing
      ? toListProductsParams({ ...listQueryRef.current, search: debouncedSearch })
      : {
          page,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(catalogId && catalogId !== CATALOG_NONE ? { catalogId } : {}),
        }

    api
      .listProducts(params)
      .then((result) => {
        if (requestId !== requestRef.current) return
        setProducts(
          !isListing && catalogId === CATALOG_NONE ? result.data.filter((item) => !item.catalogId) : result.data,
        )
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setError(undefined)
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return
        setProducts([])
        setError(cause instanceof Error ? cause.message : 'Erro ao carregar produtos')
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false)
      })
  }, [api, page, debouncedSearch, catalogId, reloadToken, isListing, listRequestKey])

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])

  // Estavel de proposito: a tela assina o Esc com esta referencia, e uma funcao nova a cada resposta
  // da listagem tiraria e recolocaria o listener a cada tecla digitada na busca.
  const closeDraft = useCallback(() => setDraft(undefined), [])

  const setListQuery = useCallback(
    (patch: Partial<ProductsListQuery>) => {
      const next = { ...listQuery, ...(patch.page === undefined ? { page: 1 } : {}), ...patch }
      if (onListQueryChange) onListQueryChange(next)
      else setInternalQuery(next)
    },
    [listQuery, onListQueryChange],
  )

  const setSearch = useCallback((value: string) => {
    setSearchValue(value)
    setPage(1)
  }, [])

  const setCatalogId = useCallback((value: string | null) => {
    setCatalogIdValue(value)
    setPage(1)
  }, [])

  const submitDraft = useCallback(
    async (input: CreateProductInput & UpdateProductInput) => {
      if (draft) {
        await api.updateProduct(draft.id, input)
      } else {
        await api.createProduct(input)
      }
      setDraft(undefined)
      reload()
    },
    [api, draft, reload],
  )

  const removeDraft = useCallback(async () => {
    if (!draft) return
    await api.deleteProduct(draft.id)
    setDraft(undefined)
    reload()
  }, [api, draft, reload])

  return useMemo(
    () => ({
      products,
      catalogs,
      loading,
      error,
      page,
      totalPages,
      total,
      search,
      catalogId,
      draft,
      listQuery,
      setListQuery,
      setSearch,
      setCatalogId,
      setPage,
      openDraft: setDraft,
      closeDraft,
      submitDraft,
      removeDraft,
      reload,
    }),
    [
      products,
      catalogs,
      loading,
      error,
      page,
      totalPages,
      total,
      search,
      catalogId,
      draft,
      listQuery,
      setListQuery,
      setSearch,
      setCatalogId,
      closeDraft,
      submitDraft,
      removeDraft,
      reload,
    ],
  )
}
