import { useState, useEffect, useRef, useCallback } from 'react'
import { useConversations } from './providers/ConversationsProvider'
import { conversationsOf } from './lib/paginated'
import type { ConversationSummary, ListConversationsParams } from './providers/types'

const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_LIMIT = 50

export interface UseWaitingNotificationsLabels {
  /** Título da notificação do sistema. Recebe a conversa para o host escolher nome × número. */
  title: (conversation: ConversationSummary) => string
  body: (conversation: ConversationSummary) => string
}

export interface UseWaitingNotificationsParams {
  /**
   * Repassado cru ao `fetchConversations`. É o que permite filtrar não lidas **no servidor** em
   * vez de baixar a lista inteira e contar no cliente: um painel com milhares de conversas não
   * pode paginar 50 por vez atrás de quem tem `unread > 0`.
   */
  readonly params?: ListConversationsParams
  readonly intervalMs?: number
  /** Desliga o polling sem desmontar quem chama — útil com a aba em segundo plano. */
  readonly enabled?: boolean
  readonly icon?: string
  readonly labels?: Partial<UseWaitingNotificationsLabels>
}

export interface UseWaitingNotificationsResult {
  unreadCount: number
  conversations: ConversationSummary[]
  /**
   * Releitura sob demanda. Existe porque o polling é o piso, não o mecanismo: quem já recebe SSE
   * ou acabou de marcar tudo como lido sabe da mudança antes do próximo tick, e esperar 10s para
   * o contador acompanhar faz a interface parecer travada.
   */
  refresh: () => Promise<void>
}

const DEFAULT_LABELS: UseWaitingNotificationsLabels = {
  title: (conversation) => conversation.clientName ?? conversation.whatsappNumber,
  body: (conversation) => conversation.lastContent ?? 'Nova mensagem',
}

export function useWaitingNotifications(params?: UseWaitingNotificationsParams): UseWaitingNotificationsResult {
  const conversationsContext = useConversations()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const previousUnreadMap = useRef<Map<string, number>>(new Map())
  const notifiedIds = useRef<Set<string>>(new Set())
  // Trava de reentrância: com a rede lenta, o tick de 10s dispara sobre a busca anterior ainda em
  // voo, e duas respostas fora de ordem fazem o contador oscilar e a notificação repetir.
  const isPollingRef = useRef(false)

  const isEnabled = params?.enabled ?? true
  const intervalMs = params?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const icon = params?.icon
  const listParams = params?.params
  const labelTitle = params?.labels?.title ?? DEFAULT_LABELS.title
  const labelBody = params?.labels?.body ?? DEFAULT_LABELS.body

  const refresh = useCallback(async () => {
    if (!conversationsContext || isPollingRef.current) return
    isPollingRef.current = true

    try {
      const result = conversationsOf(
        await conversationsContext.api.fetchConversations({ limit: DEFAULT_LIMIT, ...listParams }),
      )
      setConversations(result)

      const currentMap = new Map<string, number>()
      for (const conversation of result) currentMap.set(conversation.id, conversation.unread)

      for (const conversation of result) {
        if (conversation.unread <= 0) continue

        const previousUnread = previousUnreadMap.current.get(conversation.id) ?? 0
        if (conversation.unread <= previousUnread || notifiedIds.current.has(conversation.id)) continue

        notifiedIds.current.add(conversation.id)
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(labelTitle(conversation), { body: labelBody(conversation), ...(icon ? { icon } : {}) })
        }
      }

      previousUnreadMap.current = currentMap
    } catch {
      // Contador de badge não interrompe o atendimento: uma falha de rede some no próximo tick.
    } finally {
      isPollingRef.current = false
    }
  }, [conversationsContext, listParams, icon, labelTitle, labelBody])

  useEffect(() => {
    if (!isEnabled) return

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    void refresh()
    const interval = setInterval(() => void refresh(), intervalMs)
    return () => clearInterval(interval)
  }, [refresh, isEnabled, intervalMs])

  const unreadCount = conversations.reduce((sum, conversation) => sum + conversation.unread, 0)

  return { unreadCount, conversations, refresh }
}
