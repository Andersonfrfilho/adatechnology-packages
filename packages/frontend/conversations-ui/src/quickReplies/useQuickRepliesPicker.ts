import { useCallback, useEffect, useRef, useState } from 'react'
import { filterQuickReplies } from './quickReplySearch'
import type { QuickReply } from './quickReply.types'

export type UseQuickRepliesPickerParams = {
  readonly isOpen: boolean
  readonly search: string
  /** Chave do cache — trocar de conversa não deve carregar tudo de novo. */
  readonly conversationId: string
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
  readonly error: string | undefined
  readonly highlightedIndex: number
  readonly setHighlightedIndex: (index: number) => void
  readonly handleKeyDown: (event: { key: string; preventDefault: () => void }) => void
}

/**
 * Estado do picker do atalho `/` e do botão de raio. A lista crua é carregada uma vez por conversa
 * (guardada em `cacheRef`, sobrevive a fechar/abrir o picker) — reabrir não deve refazer a chamada
 * que a primeira abertura já fez.
 */
export function useQuickRepliesPicker({
  isOpen,
  search,
  conversationId,
  listQuickReplies,
  quickReplyVariables,
  onSelect,
  onClose,
}: UseQuickRepliesPickerParams): UseQuickRepliesPickerResult {
  const cacheRef = useRef<Map<string, QuickReply[]>>(new Map())
  const [items, setItems] = useState<QuickReply[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useEffect(() => {
    if (!isOpen || !listQuickReplies) return
    const cached = cacheRef.current.get(conversationId)
    if (cached) {
      setItems(cached)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(undefined)
    listQuickReplies()
      .then((result) => {
        if (cancelled) return
        cacheRef.current.set(conversationId, result)
        setItems(result)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as mensagens prontas.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, conversationId, listQuickReplies])

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

  return { items: filtered, isLoading, error, highlightedIndex, setHighlightedIndex, handleKeyDown }
}
