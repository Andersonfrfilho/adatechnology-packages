import { useCallback, useEffect, useRef, useState } from 'react'
import { filterQuickReplies } from './quickReplySearch'
import type { QuickReply } from './quickReply.types'

export type UseQuickRepliesPickerParams = {
  readonly isOpen: boolean
  readonly search: string
  readonly listQuickReplies?: (params?: { search?: string }) => Promise<QuickReply[]>
  readonly quickReplyVariables?: Readonly<Record<string, string>>
  readonly onSelect: (quickReply: QuickReply) => void
  readonly onClose: () => void
}

/** Extraída para ser testável sem montar o hook: a aritmética do círculo é o que a tecla decide. */
export function nextHighlightedIndex(current: number, length: number, delta: 1 | -1): number {
  if (length === 0) return 0
  return (current + delta + length) % length
}

export type UseQuickRepliesPickerResult = {
  readonly items: readonly QuickReply[]
  readonly isLoading: boolean
  /** Sinalizador puro — a mensagem exibida é sempre a do rótulo do host, nunca `caught.message` cru. */
  readonly hasError: boolean
  readonly highlightedIndex: number
  readonly setHighlightedIndex: (index: number) => void
  readonly handleKeyDown: (event: { key: string; preventDefault: () => void }) => void
  /** Refaz a busca ignorando o cache — usado quando o host quer forçar atualização da lista. */
  readonly refetch: () => void
}

/**
 * Estado do picker do atalho `/` e do botão de raio. A lista é da instalação inteira, não por
 * conversa — carregada uma vez por instância do hook (`cacheRef`, sobrevive a fechar/abrir o
 * picker) e nunca reconsultada só porque a conversa mudou. `requestIdRef` descarta resposta de
 * pedido antigo: trocar de conversa ou reabrir rápido não pode deixar `isLoading` preso em `true`
 * nem aplicar um resultado que não é mais o mais recente.
 */
export function useQuickRepliesPicker({
  isOpen,
  search,
  listQuickReplies,
  quickReplyVariables,
  onSelect,
  onClose,
}: UseQuickRepliesPickerParams): UseQuickRepliesPickerResult {
  const cacheRef = useRef<QuickReply[] | undefined>(undefined)
  const requestIdRef = useRef(0)
  const [items, setItems] = useState<QuickReply[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const load = useCallback(() => {
    if (!listQuickReplies) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setHasError(false)
    listQuickReplies()
      .then((result) => {
        if (requestIdRef.current !== requestId) return
        cacheRef.current = result
        setItems(result)
        setIsLoading(false)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return
        setHasError(true)
        setIsLoading(false)
      })
  }, [listQuickReplies])

  useEffect(() => {
    if (!isOpen || !listQuickReplies) return
    if (cacheRef.current) {
      setItems(cacheRef.current)
      return
    }
    load()
  }, [isOpen, listQuickReplies, load])

  const refetch = useCallback(() => {
    cacheRef.current = undefined
    load()
  }, [load])

  const filtered = filterQuickReplies({ quickReplies: items, search, variables: quickReplyVariables })

  useEffect(() => {
    setHighlightedIndex(0)
  }, [search, filtered.length])

  const handleKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void }) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((index) => nextHighlightedIndex(index, filtered.length, 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((index) => nextHighlightedIndex(index, filtered.length, -1))
        return
      }
      if (event.key === 'Enter') {
        const selected = filtered[highlightedIndex]
        if (!selected) return
        event.preventDefault()
        onSelect(selected)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    },
    [filtered, highlightedIndex, onSelect, onClose],
  )

  return { items: filtered, isLoading, hasError, highlightedIndex, setHighlightedIndex, handleKeyDown, refetch }
}
