/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCustomersApi } from './providers/CustomersProvider'
import type { CustomerListItem } from './providers/types'

const SEARCH_DEBOUNCE_MS = 300

export type UseCustomerSearchResult = {
  readonly customers: readonly CustomerListItem[]
  readonly total: number
  readonly page: number
  readonly perPage: number
  readonly maskPhoneInList: boolean
  readonly loading: boolean
  readonly error: Error | undefined
  setSearch(value: string): void
  setPage(value: number): void
  reload(): void
}

export function useCustomerSearch(options: { readonly perPage?: number } = {}): UseCustomerSearchResult {
  const api = useCustomersApi()
  const perPage = options.perPage ?? 20

  const [search, setSearchValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState<readonly CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [maskPhoneInList, setMaskPhoneInList] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [reloadToken, setReloadToken] = useState(0)

  /** A resposta que chega DEPOIS de uma busca mais nova é descartada: senão a lista pisca de volta. */
  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const current = ++requestId.current
    setLoading(true)

    api
      .listCustomers({ page, perPage, ...(debounced ? { search: debounced } : {}) })
      .then((result) => {
        if (current !== requestId.current) return
        setCustomers(result.data)
        setTotal(result.pagination.total)
        setMaskPhoneInList(result.maskPhoneInList)
        setError(undefined)
      })
      .catch((caught: unknown) => {
        if (current !== requestId.current) return
        // Lista que falha NÃO vira lista vazia: "nenhum cliente" e "não deu para carregar" são
        // coisas diferentes, e a segunda tem conserto.
        setError(caught instanceof Error ? caught : new Error(String(caught)))
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false)
      })
  }, [api, page, perPage, debounced, reloadToken])

  const setSearch = useCallback((value: string) => {
    setSearchValue(value)
    setPage(1)
  }, [])

  return {
    customers,
    total,
    page,
    perPage,
    maskPhoneInList,
    loading,
    error,
    setSearch,
    setPage,
    reload: useCallback(() => setReloadToken((token) => token + 1), []),
  }
}
