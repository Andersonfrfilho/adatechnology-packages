import { useCallback, useLayoutEffect, useRef, type RefObject, type UIEvent } from 'react'

/**
 * Chegar perto do topo do transcript dispara a busca da página anterior, e a posição de rolagem é
 * recalculada depois que o DOM cresce por cima do ponto atual — sem isso, prepender mensagens
 * empurra visualmente tudo para baixo e o operador perde a linha onde estava lendo.
 */
const NEAR_TOP_THRESHOLD_PX = 200

export type ScrollHeightSnapshot = {
  readonly scrollHeight: number
  readonly scrollTop: number
}

/** Novo `scrollTop` que mantém o mesmo ponto visual depois que o conteúdo cresceu por cima. */
export function computeScrollTopAfterPrepend(before: ScrollHeightSnapshot, scrollHeightAfter: number): number {
  return before.scrollTop + (scrollHeightAfter - before.scrollHeight)
}

export type UseLoadOlderMessagesScrollParams = {
  readonly containerRef: RefObject<HTMLDivElement | null>
  /** `id` da mensagem mais antiga já carregada — muda quando uma página nova é prependida. */
  readonly oldestMessageId: string | undefined
  readonly hasMore: boolean
  readonly loading: boolean
  readonly onLoadOlder: () => void
}

export type UseLoadOlderMessagesScrollResult = {
  /** Ligue no `onScroll` do mesmo elemento que `containerRef`. */
  readonly handleScroll: (event: UIEvent<HTMLDivElement>) => void
  /** Para o botão "Carregar mensagens anteriores" — mesma lógica do gatilho por scroll. */
  readonly triggerLoadOlder: () => void
}

export function useLoadOlderMessagesScroll({
  containerRef,
  oldestMessageId,
  hasMore,
  loading,
  onLoadOlder,
}: UseLoadOlderMessagesScrollParams): UseLoadOlderMessagesScrollResult {
  const pendingSnapshotRef = useRef<ScrollHeightSnapshot | null>(null)
  const previousOldestMessageIdRef = useRef(oldestMessageId)

  const triggerLoadOlder = useCallback(() => {
    if (loading || !hasMore) return
    const container = containerRef.current
    if (!container) return

    pendingSnapshotRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop }
    onLoadOlder()
  }, [containerRef, hasMore, loading, onLoadOlder])

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop > NEAR_TOP_THRESHOLD_PX) return
      triggerLoadOlder()
    },
    [triggerLoadOlder],
  )

  useLayoutEffect(() => {
    const idChanged = previousOldestMessageIdRef.current !== oldestMessageId
    previousOldestMessageIdRef.current = oldestMessageId

    const container = containerRef.current
    const pending = pendingSnapshotRef.current
    if (!idChanged || !container || !pending) return

    pendingSnapshotRef.current = null
    container.scrollTop = computeScrollTopAfterPrepend(pending, container.scrollHeight)
  }, [oldestMessageId, containerRef])

  return { handleScroll, triggerLoadOlder }
}
