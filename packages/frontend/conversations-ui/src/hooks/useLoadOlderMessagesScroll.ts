import { useCallback, useLayoutEffect, useRef, type RefObject, type UIEvent } from 'react'

/**
 * A busca da página anterior começa antes de o operador chegar ao topo: a cerca de uma tela de
 * distância (nunca menos que este piso). Esperar o topo deixava o operador parado olhando o
 * esqueleto a cada 50 mensagens; com a folga, a página costuma chegar enquanto ele ainda lê.
 */
const PREFETCH_MINIMUM_DISTANCE_PX = 600

/** Distância do topo a partir da qual a página anterior é pedida. */
export function computePrefetchDistance(clientHeight: number): number {
  return Math.max(PREFETCH_MINIMUM_DISTANCE_PX, clientHeight)
}

export function shouldPrefetchOlderMessages(scrollTop: number, clientHeight: number): boolean {
  return scrollTop <= computePrefetchDistance(clientHeight)
}

/**
 * A mensagem mais antiga já exibida serve de âncora: o que entra por cima a empurra para baixo, e
 * somar esse deslocamento ao `scrollTop` *atual* devolve o operador exatamente à linha que estava
 * lendo — inclusive se ele continuou rolando enquanto a página chegava (o que o prefetch torna
 * comum) ou se uma mensagem nova entrou no fim da conversa nesse meio tempo.
 */
export function computeScrollTopAfterPrepend(
  currentScrollTop: number,
  anchorOffsetTopBefore: number,
  anchorOffsetTopAfter: number,
): number {
  return currentScrollTop + (anchorOffsetTopAfter - anchorOffsetTopBefore)
}

/** Atributo que identifica cada mensagem no transcript — é por ele que a âncora é reencontrada. */
export const MESSAGE_ID_ATTRIBUTE = 'data-message-id'

type PendingAnchor = {
  readonly messageId: string
  readonly offsetTop: number
}

function findMessageElement(container: HTMLElement, messageId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[${MESSAGE_ID_ATTRIBUTE}="${CSS.escape(messageId)}"]`)
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
  const pendingAnchorRef = useRef<PendingAnchor | null>(null)
  const previousOldestMessageIdRef = useRef(oldestMessageId)

  const triggerLoadOlder = useCallback(() => {
    if (loading || !hasMore) return
    const container = containerRef.current
    if (!container) return

    const anchorElement = oldestMessageId ? findMessageElement(container, oldestMessageId) : null
    pendingAnchorRef.current =
      oldestMessageId && anchorElement ? { messageId: oldestMessageId, offsetTop: anchorElement.offsetTop } : null
    onLoadOlder()
  }, [containerRef, hasMore, loading, oldestMessageId, onLoadOlder])

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget
      if (!shouldPrefetchOlderMessages(target.scrollTop, target.clientHeight)) return
      triggerLoadOlder()
    },
    [triggerLoadOlder],
  )

  useLayoutEffect(() => {
    const idChanged = previousOldestMessageIdRef.current !== oldestMessageId
    previousOldestMessageIdRef.current = oldestMessageId

    const container = containerRef.current
    const pending = pendingAnchorRef.current
    if (!idChanged || !container || !pending) return

    pendingAnchorRef.current = null
    const anchorElement = findMessageElement(container, pending.messageId)
    if (!anchorElement) return
    container.scrollTop = computeScrollTopAfterPrepend(container.scrollTop, pending.offsetTop, anchorElement.offsetTop)
  }, [oldestMessageId, containerRef])

  return { handleScroll, triggerLoadOlder }
}
