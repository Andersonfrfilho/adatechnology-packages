import { useState, useEffect, useRef, useCallback } from 'react'
import { useConversations } from './providers/ConversationsProvider'
import type { ConversationSummary } from './providers/types'

interface UseWaitingNotificationsResult {
  unreadCount: number
  conversations: ConversationSummary[]
}

export function useWaitingNotifications(): UseWaitingNotificationsResult {
  const conversationsCtx = useConversations()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const previousUnreadMap = useRef<Map<string, number>>(new Map())
  const notifiedIds = useRef<Set<string>>(new Set())

  const pollConversations = useCallback(async () => {
    if (!conversationsCtx) return

    try {
      const result = await conversationsCtx.api.fetchConversations({ limit: 50 })
      setConversations(result)

      const currentMap = new Map<string, number>()
      for (const conv of result) {
        currentMap.set(conv.id, conv.unread)
      }

      for (const conv of result) {
        if (conv.unread <= 0) continue

        const prev = previousUnreadMap.current.get(conv.id) ?? 0

        if (conv.unread > prev && !notifiedIds.current.has(conv.id)) {
          notifiedIds.current.add(conv.id)

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const title = conv.clientName ?? conv.whatsappNumber
            const body = conv.lastContent ?? 'Nova mensagem'
            new Notification(title, { body, icon: '/favicon.ico' })
          }
        }
      }

      previousUnreadMap.current = currentMap
    } catch {
      // Silently ignore polling errors
    }
  }, [conversationsCtx])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    pollConversations()

    const interval = setInterval(pollConversations, 10_000)
    return () => clearInterval(interval)
  }, [pollConversations])

  const unreadCount = conversations.reduce((sum, conv) => sum + conv.unread, 0)

  return { unreadCount, conversations }
}
