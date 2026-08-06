import { createContext, useContext, useMemo, type ReactNode } from 'react'
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
  // Objeto novo a cada render fazia todo efeito que depende do contexto reexecutar junto — o do
  // `useConversationRealtime` fecha e reabre o SSE da conversa, e cada reabertura pede um ticket
  // novo. Uma tela que renderiza em rajada saturava as 6 conexões do navegador com requisições
  // pendentes que nunca chegavam a servir para nada.
  const value = useMemo(() => ({ api, sse }), [api, sse])

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>
}

export function useConversations(): ConversationsContextValue | null {
  return useContext(ConversationsContext)
}
