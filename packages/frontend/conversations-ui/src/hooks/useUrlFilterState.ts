/**
 * Estado de listagem espelhado na URL — ordenação, filtros e paginação (regra `web.md` §7).
 *
 * Escrito sobre `history.replaceState` e não sobre um router: o pacote roda em três produtos com
 * routers diferentes, e exigir um deles arrastaria dependência de framework para dentro do módulo.
 * `replaceState` também é o comportamento certo aqui — filtrar não é navegar, e cada tecla digitada
 * na busca não deve virar uma entrada no botão "voltar".
 */

import { useCallback, useEffect, useState } from 'react'

const LIST_SEPARATOR = ','

function readParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function writeParam(key: string, value: string | undefined): void {
  if (typeof window === 'undefined') return
  const params = readParams()
  if (value === undefined || value === '') params.delete(key)
  else params.set(key, value)
  const query = params.toString()
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname)
}

/** `enabled: false` mantém o mesmo contrato de estado sem tocar na URL — para uso em preview e teste. */
export interface UrlStateOptions {
  readonly enabled?: boolean
}

export function useUrlStringState(
  key: string,
  initial: string,
  { enabled = true }: UrlStateOptions = {},
): [string, (next: string) => void] {
  const [value, setValue] = useState(() => (enabled ? (readParams().get(key) ?? initial) : initial))

  const update = useCallback(
    (next: string) => {
      setValue(next)
      if (enabled) writeParam(key, next === initial ? undefined : next)
    },
    [enabled, key, initial],
  )

  return [value, update]
}

export function useUrlNumberState(
  key: string,
  initial: number,
  { enabled = true }: UrlStateOptions = {},
): [number, (next: number) => void] {
  const [value, setValue] = useState(() => {
    if (!enabled) return initial
    const raw = Number(readParams().get(key))
    return Number.isFinite(raw) && raw > 0 ? raw : initial
  })

  const update = useCallback(
    (next: number) => {
      setValue(next)
      if (enabled) writeParam(key, next === initial ? undefined : String(next))
    },
    [enabled, key, initial],
  )

  return [value, update]
}

export function useUrlArrayState(
  key: string,
  { enabled = true }: UrlStateOptions = {},
): [readonly string[], (next: readonly string[]) => void] {
  const [value, setValue] = useState<readonly string[]>(() => {
    if (!enabled) return []
    const raw = readParams().get(key)
    return raw ? raw.split(LIST_SEPARATOR).filter(Boolean) : []
  })

  const update = useCallback(
    (next: readonly string[]) => {
      setValue(next)
      if (enabled) writeParam(key, next.length > 0 ? next.join(LIST_SEPARATOR) : undefined)
    },
    [enabled, key],
  )

  return [value, update]
}

/**
 * Espera o usuário parar de digitar antes de deixar o valor chegar à query. Sem isto, cada tecla
 * na busca vira uma chamada de rede e uma reescrita de URL.
 */
export function useDebouncedValue<TValue>(value: TValue, delayMs = 300): TValue {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
