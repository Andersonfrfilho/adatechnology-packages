import React, { createContext, useContext } from 'react'

export interface ConversationLocales {
  bubble: {
    customer: string
    bot: string
    agent: string
    document: string
    media: string
    templateLabel: string
    readAt: string
    windowExpired: string
    viewImage: string
    listenAudio: string
    viewVideo: string
    moderationFlagged: string
  }
  selection: {
    select: string
  }
  dateDivider: {
    today: string
    yesterday: string
  }
}

const DEFAULT_LOCALES: ConversationLocales = {
  bubble: {
    customer: 'Cliente',
    bot: 'Bot',
    agent: 'Atendente',
    document: 'documento',
    media: 'mídia',
    templateLabel: 'Template',
    readAt: 'Lida às ',
    windowExpired: 'Janela de 24h expirada',
    viewImage: 'Ver imagem',
    listenAudio: 'Ouvir áudio',
    viewVideo: 'Ver vídeo',
    moderationFlagged: 'Linguagem ofensiva',
  },
  selection: {
    select: 'Selecionar',
  },
  dateDivider: {
    today: 'Hoje',
    yesterday: 'Ontem',
  },
}

type PartialLocales = {
  [K in keyof ConversationLocales]?: Partial<ConversationLocales[K]>
}

const ConversationLocalesContext = createContext<ConversationLocales>(DEFAULT_LOCALES)

export interface ConversationLocalesProviderProps {
  children: React.ReactNode
  locales?: PartialLocales
}

export function ConversationLocalesProvider({ children, locales }: ConversationLocalesProviderProps) {
  const merged: ConversationLocales = {
    bubble: { ...DEFAULT_LOCALES.bubble, ...locales?.bubble },
    selection: { ...DEFAULT_LOCALES.selection, ...locales?.selection },
    dateDivider: { ...DEFAULT_LOCALES.dateDivider, ...locales?.dateDivider },
  }

  return (
    <ConversationLocalesContext.Provider value={merged}>
      {children}
    </ConversationLocalesContext.Provider>
  )
}

export function useConversationLocales(): ConversationLocales {
  return useContext(ConversationLocalesContext)
}
