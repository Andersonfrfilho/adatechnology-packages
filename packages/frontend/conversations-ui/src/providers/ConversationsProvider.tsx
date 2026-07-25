import { createContext, useContext, type ReactNode } from 'react'
import type { ConversationsApi, SSEProvider } from './types'

interface ConversationsContextValue {
  api: ConversationsApi
  sse: SSEProvider
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null)

export function ConversationsProvider({
  api,
  sse,
  children,
}: {
  api: ConversationsApi
  sse: SSEProvider
  children: ReactNode
}) {
  return (
    <ConversationsContext.Provider value={{ api, sse }}>
      {children}
    </ConversationsContext.Provider>
  )
}

export function useConversations(): ConversationsContextValue | null {
  return useContext(ConversationsContext)
}
