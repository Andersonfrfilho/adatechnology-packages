import { useCallback, useLayoutEffect, useRef, useState, type RefObject, type UIEvent } from 'react'

/**
 * Mantém a conversa no fim, como todo mensageiro.
 *
 * Abrir uma conversa no topo do histórico é errado por um motivo simples: o que interessa ao
 * atendente é a última mensagem, e ele teria que rolar por semanas de conversa para chegar nela.
 *
 * Existe no pacote, e não em cada host, porque a regra tem duas sutilezas que se descobre só
 * errando — o salto instantâneo na troca de conversa e o respeito a quem rolou para trás — e
 * reimplementá-las em cada inbox garante que uma delas fique de fora.
 */

/**
 * Distância do fim, em pixels, dentro da qual ainda consideramos o operador "acompanhando".
 *
 * Não é zero porque o navegador arredonda `scrollTop` fracionário em telas com zoom ou densidade
 * alta: exigir o fim exato faria o painel achar que o operador rolou para trás sem ele ter tocado
 * em nada, e a próxima mensagem não apareceria.
 */
const NEAR_BOTTOM_THRESHOLD_PX = 120

/**
 * Toda rolagem aqui é `'auto'` — nunca `'smooth'`.
 *
 * Tentamos suave para mensagem nova e medimos: em ambiente onde a rolagem suave está desligada, o
 * `scrollTo({ behavior: 'smooth' })` **não faz nada e não avisa** — a mensagem nova simplesmente não
 * entra na vista. E não dá para detectar isso pelo `prefers-reduced-motion`: no navegador em que
 * reproduzimos, a media query respondia `false` e o smooth continuava sendo no-op.
 *
 * Trocar uma animação cosmética por garantia de que o operador vê a mensagem é barato: seguir uma
 * mensagem nova salta a altura de uma bolha, que é quase imperceptível de qualquer forma.
 */
const SCROLL_BEHAVIOR: ScrollBehavior = 'auto'

export type UseScrollToLatestMessageParams = {
  /** Troca de conversa. Muda ⇒ salto instantâneo para o fim. */
  readonly conversationId: string | undefined
  /** Quantidade de mensagens carregadas. Cresce ⇒ acompanha o fim, se o operador estiver lá. */
  readonly messageCount: number
}

export type UseScrollToLatestMessageResult = {
  /** Vai no elemento que rola — tipicamente o `ConversationWallpaper`. */
  readonly containerRef: RefObject<HTMLDivElement | null>
  /** Ligue no `onScroll` do mesmo elemento: é o que detecta o operador lendo o histórico. */
  readonly handleScroll: (event: UIEvent<HTMLDivElement>) => void
  /** `true` quando o operador rolou para trás — serve a um botão "ir para a última". */
  readonly isAwayFromBottom: boolean
  readonly scrollToBottom: (behavior?: ScrollBehavior) => void
}

export function useScrollToLatestMessage({
  conversationId,
  messageCount,
}: UseScrollToLatestMessageParams): UseScrollToLatestMessageResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false)

  /**
   * Espelha `isAwayFromBottom` para o efeito de mensagens novas ler o valor atual sem depender dele.
   *
   * Se o efeito dependesse do estado, cada rolagem do operador o re-disparava e o puxava de volta
   * para o fim — exatamente o que a checagem existe para evitar.
   */
  const isAwayFromBottomRef = useRef(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = SCROLL_BEHAVIOR) => {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
  }, [])

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    const away = distanceFromBottom > NEAR_BOTTOM_THRESHOLD_PX

    isAwayFromBottomRef.current = away
    setIsAwayFromBottom((current) => (current === away ? current : away))
  }, [])

  /**
   * Qual conversa já recebeu o salto de abertura.
   *
   * É o que separa "abriu a conversa" de "chegou mensagem", e não dá para usar só `conversationId`
   * num efeito próprio: quando a conversa troca, a lista de mensagens ainda está vazia, então um
   * salto ali rola um container sem conteúdo e não faz nada. O salto real precisa esperar a primeira
   * leva de mensagens — e foi exatamente isso que deixou a conversa abrindo no topo.
   */
  const jumpedForConversationRef = useRef<string | undefined>(undefined)

  useLayoutEffect(() => {
    const isNewConversation = jumpedForConversationRef.current !== conversationId

    if (isNewConversation) {
      // Zera antes de qualquer coisa: "rolado para trás" da conversa anterior não pode bloquear o
      // salto de abertura desta.
      isAwayFromBottomRef.current = false
      setIsAwayFromBottom(false)

      // Sem mensagens ainda — o salto acontece quando a primeira leva chegar.
      if (messageCount === 0) return

      jumpedForConversationRef.current = conversationId
      /**
       * `'auto'`, sempre. Animar a rolagem por meses de histórico demora, mostra um borrão de
       * mensagens antigas que ninguém pediu, e some por completo onde a rolagem suave está desligada
       * (`prefers-reduced-motion`, alguns navegadores automatizados) — a conversa simplesmente
       * abriria no topo. Abertura é salto, não animação.
       */
      scrollToBottom(SCROLL_BEHAVIOR)
      return
    }

    /**
     * Mensagem nova: acompanha, mas só se o operador já estava no fim.
     *
     * Puxar a rolagem de quem está lendo o histórico é pior do que não mostrar a mensagem — ele perde
     * a posição e não sabe por quê. Quem rolou para trás recebe `isAwayFromBottom` e decide.
     */
    if (isAwayFromBottomRef.current) return
    scrollToBottom(SCROLL_BEHAVIOR)
  }, [conversationId, messageCount, scrollToBottom])

  return { containerRef, handleScroll, isAwayFromBottom, scrollToBottom }
}
