import { useState, useEffect, useCallback, useRef } from 'react'
import type { Product, ProductsApi } from './providers/types'

export type UseProductSearchOptions = {
  readonly api: ProductsApi
  readonly debounceMs?: number
}

export type UseProductSearchResult = {
  readonly query: string
  readonly setQuery: (value: string) => void
  readonly results: readonly Product[]
  readonly loading: boolean
}

export function useProductSearch({ api, debounceMs = 300 }: UseProductSearchOptions): UseProductSearchResult {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly Product[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (searchTerm: string) => {
      if (!searchTerm.trim()) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await api.listProducts({ search: searchTerm.trim() })
        setResults(result.data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      search(query)
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [query, debounceMs, search])

  return { query, setQuery, results, loading }
}
