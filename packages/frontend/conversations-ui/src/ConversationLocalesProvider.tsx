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
    mediaLoading: string
    mediaRetry: string
    mediaError: string
    mediaUnavailable: string
    imageAlt: string
    untitledDocument: string
    downloadFile: string
  }
  transcription: {
    label: string
    copy: string
    copied: string
    transcribe: string
    transcribing: string
    retry: string
    failed: string
    /** Áudio processado sem fala detectada — distinto de "não transcrito". */
    empty: string
    unsupported: string
    showMore: string
    showLess: string
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
    mediaLoading: 'Carregando...',
    mediaRetry: 'Erro — tentar novamente',
    mediaError: 'Erro',
    mediaUnavailable: 'Mídia indisponível',
    imageAlt: 'Imagem',
    untitledDocument: 'Documento',
    downloadFile: 'Baixar',
  },
  transcription: {
    label: 'Transcrição',
    copy: 'Copiar',
    copied: 'Copiado!',
    transcribe: 'Transcrever áudio',
    transcribing: 'Transcrevendo...',
    retry: 'Transcrever novamente',
    failed: 'Falha ao transcrever — tentar novamente',
    empty: 'Sem fala detectada',
    unsupported: 'Formato de áudio não suportado para transcrição',
    showMore: 'ver transcrição completa',
    showLess: 'ver menos',
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
    transcription: { ...DEFAULT_LOCALES.transcription, ...locales?.transcription },
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
