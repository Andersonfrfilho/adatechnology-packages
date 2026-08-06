/**
 * Estado da inbox: filtros, paginação, seleção em massa e ações de atendimento.
 *
 * Nasceu igual em três produtos e divergiu em três — contadores diferentes, um marcava lida ao
 * abrir e outro não, um perdia a página ao trocar de filtro. É a lógica de operar uma inbox, não
 * regra de nenhum negócio, e por isso mora aqui.
 *
 * A paginação é do cliente porque nem todo backend pagina a listagem. Fatiar aqui mantém a tela
 * utilizável com centenas de conversas; com dezenas de milhares o gargalo volta e a resposta é
 * paginar no servidor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useConversationList } from '../hooks/useConversationList'
import { useGlobalRealtime } from '../hooks/useConversationRealtime'
import { useConversations } from '../providers/ConversationsProvider'
import { CONVERSATION_WINDOW, windowOf, type ConversationWindow } from '../conversationWindow'
import { isWindowBlocking } from '../WindowExpiredNotice'
import {
  CHANNEL_FILTER_ALL,
  DEFAULT_CONVERSATION_CHANNEL,
  channelFiltersFor,
  type ChannelFilter,
  type ChannelFilterOption,
} from '../conversationChannel'
import type { ConversationSummary } from '../providers/types'

export const CONVERSATIONS_PER_PAGE = 50

export interface UseConversationsInboxParams {
  /** Recortes do produto repassados crus ao backend dele (carteira, campanha, tipo). */
  readonly filters?: Record<string, string | undefined>
  readonly perPage?: number
  /**
   * Marca como lida a conversa aberta. Ligado por padrão: badge subindo na conversa que o atendente
   * tem na frente é ruído que ele não tem como resolver.
   */
  readonly markReadOnOpen?: boolean
  /**
   * Pede a página ao servidor em vez de fatiar o que veio. Necessário quando a base é grande — o
   * padrão traz tudo e pagina no cliente porque nem todo backend pagina a listagem.
   */
  readonly serverPaginated?: boolean
  readonly describeFailure?: (error: unknown) => string
}

export interface UseConversationsInboxResult {
  readonly conversations: readonly ConversationSummary[]
  readonly pageConversations: readonly ConversationSummary[]
  readonly selectedConversation: ConversationSummary | undefined
  readonly loading: boolean
  readonly now: number
  readonly totalCount: number
  readonly unreadCount: number
  readonly waitingCount: number
  readonly filteredCount: number
  /** Selecionadas fora da janela de 24h — as únicas que um template alcança. */
  readonly expiredSelectedCount: number
  readonly page: number
  readonly pageCount: number
  readonly firstOnPage: number
  readonly lastOnPage: number
  readonly selectedId: string | undefined
  readonly selectedIds: ReadonlySet<string>
  readonly allOnPageSelected: boolean
  readonly waitingOnly: boolean
  readonly windowFilter: ConversationWindow
  readonly channelFilter: ChannelFilter
  readonly channelFilters: readonly ChannelFilterOption[]
  readonly search: string
  readonly busy: boolean
  /** Por que a lista está vazia, quando não é por não haver conversa. */
  readonly loadFailure: string | undefined
  /** Ausentes quando o host não implementa a capacidade — a UI não desenha a afordância. */
  readonly canTakeover: boolean
  readonly canFinalize: boolean
  readonly canListTemplates: boolean
  readonly canMarkAllRead: boolean
  refetch(): Promise<void> | void
  selectConversation(conversationId: string): void
  clearSelection(): void
  toggleSelected(conversationId: string): void
  toggleSelectAllOnPage(): void
  clearBulkSelection(): void
  setWaitingOnly(value: boolean): void
  setWindowFilter(value: ConversationWindow): void
  setChannelFilter(value: ChannelFilter): void
  setSearch(value: string): void
  goToPage(value: number): void
  markSelectedAsRead(): Promise<void>
  markAllAsRead(): Promise<void>
  takeover(conversationId: string): Promise<void>
  releaseToBot(conversationId: string): Promise<void>
  finalize(conversationId: string): Promise<void>
  finalizeSelected(): Promise<void>
  sendTemplateToSelected(templateName?: string): Promise<void>
}

function defaultDescribeFailure(error: unknown): string {
  const status = (error as { status?: number }).status
  if (status === 401 || status === 403) {
    return 'Sessão expirada nesta aba — entre no painel de novo para ver as conversas.'
  }
  return error instanceof Error && error.message
    ? `Não foi possível carregar as conversas: ${error.message}`
    : 'Não foi possível carregar as conversas.'
}

export function useConversationsInbox(params: UseConversationsInboxParams = {}): UseConversationsInboxResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationsInbox requires an ancestor <ConversationsProvider>')
  }
  const { api } = context
  const perPage = params.perPage ?? CONVERSATIONS_PER_PAGE
  const markReadOnOpen = params.markReadOnOpen ?? true
  const describeFailure = params.describeFailure ?? defaultDescribeFailure

  const [waitingOnly, setWaitingOnly] = useState(false)
  const [windowFilter, setWindowFilter] = useState<ConversationWindow>(CONVERSATION_WINDOW.ALL)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(CHANNEL_FILTER_ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const { conversations, total, loading, error, refetch } = useConversationList({
    ...(waitingOnly ? { waitingHuman: true } : {}),
    ...(search ? { search } : {}),
    ...(params.filters ? { filters: params.filters } : {}),
    ...(params.serverPaginated ? { page, limit: perPage } : {}),
  })

  // `data-changed` é o único evento do canal global e vem sem payload: a resposta correta é refazer
  // a query, não deduzir o que mudou.
  useGlobalRealtime(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  // Carimbo único por render: recalcular `Date.now()` por linha faria conversas na fronteira de
  // 12h/21h/24h caírem em faixas diferentes na mesma tela.
  const now = useMemo(() => Date.now(), [conversations])

  const filtered = useMemo(
    () =>
      conversations
        .filter(
          (conversation) =>
            channelFilter === CHANNEL_FILTER_ALL ||
            (conversation.channel ?? DEFAULT_CONVERSATION_CHANNEL) === channelFilter,
        )
        .filter(
          (conversation) =>
            windowFilter === CONVERSATION_WINDOW.ALL ||
            windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel }) ===
              windowFilter,
        ),
    [conversations, windowFilter, channelFilter, now],
  )

  // Com paginação no servidor o que veio JÁ é a página: refatiar deixaria a lista vazia da segunda
  // página em diante, e o total do servidor é quem sabe quantas páginas existem.
  const totalForPaging = params.serverPaginated ? total : filtered.length
  const pageCount = Math.max(1, Math.ceil(totalForPaging / perPage))
  const currentPage = Math.min(page, pageCount)
  const pageConversations = params.serverPaginated
    ? filtered
    : filtered.slice((currentPage - 1) * perPage, currentPage * perPage)

  // Trocar de filtro com a página 7 ativa deixaria a lista vazia sem explicação.
  useEffect(() => {
    setPage(1)
  }, [search, waitingOnly, windowFilter, channelFilter])

  useEffect(() => {
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(undefined)
    }
  }, [conversations, selectedId])

  /**
   * Guarda contra laço quente: marcar dispara `refetch`, que muda `conversations`, que reexecuta o
   * efeito. `unread === 0` encerra o ciclo normal, mas com rota falhando ou dado velho o par se
   * repetiria para sempre — uma requisição por render só aparece na aba deixada aberta.
   */
  const lastMarkReadAttempt = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!markReadOnOpen || !selectedId) return

    const opened = conversations.find((conversation) => conversation.id === selectedId)
    if (!opened || opened.unread === 0) return

    const attempt = `${selectedId}:${opened.unread}`
    if (lastMarkReadAttempt.current === attempt) return
    lastMarkReadAttempt.current = attempt

    void api
      .markRead(selectedId)
      .then(() => refetch())
      .catch(() => {
        // Sem tratamento visível: falhar deixa o badge onde estava, que é a verdade. Um alerta a
        // mais competiria com o atendimento.
      })
  }, [markReadOnOpen, selectedId, conversations, refetch, api])

  const toggleSelected = useCallback((conversationId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(conversationId)) next.delete(conversationId)
      else next.add(conversationId)
      return next
    })
  }, [])

  const pageIds = pageConversations.map((conversation) => conversation.id)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const toggleSelectAllOnPage = useCallback((): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }, [allOnPageSelected, pageIds])

  const runOnSelection = useCallback(
    async (action: (conversationId: string) => Promise<void>): Promise<void> => {
      setBusy(true)
      try {
        // Em paralelo para não somar latência; é por não existir rota em lote que a ação age sobre
        // a seleção, e não sobre a inbox inteira.
        await Promise.all([...selectedIds].map(action))
        setSelectedIds(new Set())
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    [selectedIds, refetch],
  )

  const runConversationAction = useCallback(
    async (action: ((conversationId: string) => Promise<void>) | undefined, conversationId: string) => {
      if (!action) return
      setBusy(true)
      try {
        await action(conversationId)
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    [refetch],
  )

  return {
    conversations,
    pageConversations,
    selectedConversation: conversations.find((conversation) => conversation.id === selectedId),
    loading,
    now,
    // Com paginação no servidor `conversations` é só a página, então contar o array mostrava o
    // tamanho da página no lugar do tamanho da base. Não lidas e aguardando seguem sendo da página:
    // somar a base inteira exige agregado do servidor, que a listagem não devolve.
    totalCount: params.serverPaginated ? total : conversations.length,
    unreadCount: conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
    waitingCount: conversations.filter((conversation) => conversation.waitingHuman).length,
    filteredCount: totalForPaging,
    expiredSelectedCount: conversations.filter(
      (conversation) =>
        selectedIds.has(conversation.id) &&
        isWindowBlocking(windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel })),
    ).length,
    page: currentPage,
    pageCount,
    firstOnPage: (currentPage - 1) * perPage + 1,
    lastOnPage: Math.min(currentPage * perPage, totalForPaging),
    selectedId,
    selectedIds,
    allOnPageSelected,
    waitingOnly,
    windowFilter,
    channelFilter,
    channelFilters: channelFiltersFor(conversations),
    search,
    busy,
    loadFailure: error ? describeFailure(error) : undefined,
    canTakeover: Boolean(api.takeover),
    canFinalize: Boolean(api.finalize),
    canListTemplates: Boolean(api.listTemplates),
    canMarkAllRead: Boolean(api.markAllRead),
    refetch,
    selectConversation: setSelectedId,
    clearSelection: () => setSelectedId(undefined),
    toggleSelected,
    toggleSelectAllOnPage,
    clearBulkSelection: () => setSelectedIds(new Set()),
    setWaitingOnly,
    setWindowFilter,
    setChannelFilter,
    setSearch,
    goToPage: setPage,
    markSelectedAsRead: () => runOnSelection((conversationId) => api.markRead(conversationId)),
    markAllAsRead: async () => {
      if (!api.markAllRead) return
      setBusy(true)
      try {
        await api.markAllRead()
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    takeover: (conversationId) => runConversationAction(api.takeover, conversationId),
    releaseToBot: (conversationId) => runConversationAction(api.release, conversationId),
    finalize: (conversationId) => runConversationAction(api.finalize, conversationId),
    finalizeSelected: () =>
      runOnSelection(async (conversationId) => {
        await api.finalize?.(conversationId)
      }),
    sendTemplateToSelected: (templateName) =>
      runOnSelection(async (conversationId) => {
        await api.sendTemplate(conversationId, templateName ? { templateName } : {})
      }),
  }
}
