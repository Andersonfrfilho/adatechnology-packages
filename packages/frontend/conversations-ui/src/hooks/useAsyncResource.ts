import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncResourceState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
}

// Fundação interna da camada headless — busca uma vez por mudança de `deps`, expõe
// `refetch` para revalidação manual, e ignora respostas de requisições obsoletas
// (evita "race condition" clássica quando conversationId muda rápido).
export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncResourceState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(undefined)
    try {
      const result = await fetcher()
      if (requestId === requestIdRef.current) setData(result)
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, refetch: load }
}
