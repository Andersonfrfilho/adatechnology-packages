/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncResource<TData> = {
  readonly data: TData | undefined
  readonly isLoading: boolean
  readonly error: unknown
  readonly reload: () => void
}

/**
 * Carrega um recurso e descarta resposta velha: trocar de página rápido não deixa a resposta da
 * página anterior chegar por último e sobrescrever a atual. O pacote não traz cliente de cache
 * próprio — quem quiser TanStack Query implementa a API injetada sobre ele.
 */
export function useAsyncResource<TData>(load: () => Promise<TData>, key: string): AsyncResource<TData> {
  const [state, setState] = useState<{ data?: TData; isLoading: boolean; error?: unknown }>({ isLoading: true })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let isCurrent = true
    setState((previous) => ({ ...previous, isLoading: true, error: undefined }))
    loadRef
      .current()
      .then((data) => {
        if (isCurrent) setState({ data, isLoading: false })
      })
      .catch((error: unknown) => {
        if (isCurrent) setState({ isLoading: false, error })
      })
    return () => {
      isCurrent = false
    }
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  return { data: state.data, isLoading: state.isLoading, error: state.error, reload }
}
