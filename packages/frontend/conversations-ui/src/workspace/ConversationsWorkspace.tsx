/**
 * A tela de atendimento inteira: cabeçalho com contadores, lista, conversa e simulador.
 *
 * Existe porque o pacote exportava só as peças, e cada produto montava a própria grade — foi assim
 * que a mesma inbox ganhou três larguras de coluna, dois comportamentos em tela estreita e um lugar
 * diferente para o botão do simulador. A composição é a parte que precisa ser idêntica; o que muda
 * de produto entra pelos slots, não por uma cópia da tela.
 *
 * Customização: `labels` (texto e idioma), `renderFilters` / `renderBulkActions` /
 * `renderAboveTranscript` / `renderRow` (peças do produto), `contextEntriesOf` (vocabulário do
 * contexto), `extraUtilities` (ações no cabeçalho da conversa) e `simulator` (painel de preview).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import type { ConversationContextEntry } from '../ConversationContextPanel'
import type { ConversationHeaderUtility } from '../ConversationHeader'
import type { QuickReply } from '../MessageComposer'
import type { RichComposerVariable } from '../RichMessageComposer'
import type { ConversationSummary } from '../providers/types'
import { BulkTemplateModal } from './BulkTemplateModal'
import { ConversationPane } from './ConversationPane'
import { ConversationsInboxList } from './ConversationsInboxList'
import { DEFAULT_CONVERSATIONS_WORKSPACE_LABELS, type ConversationsWorkspaceLabels } from './labels'
import { useConversationsInbox, type UseConversationsInboxResult } from './useConversationsInbox'

export interface ConversationsWorkspaceSimulator {
  /**
   * Desenha o painel do cliente. Fica com o host porque o simulador precisa da rota assinada no
   * servidor DELE — e é o que mantém o `preview/` fora do bundle de quem não usa.
   */
  render(params: { conversationId: string; close: () => void }): ReactNode
  /** Ausente = ligado. Serve para esconder fora de desenvolvimento sem condicionar o JSX. */
  readonly enabled?: boolean
  readonly icon?: string
  readonly label?: string
}

export interface ConversationsWorkspaceProps {
  readonly labels?: Partial<ConversationsWorkspaceLabels>
  readonly filters?: Record<string, string | undefined>
  readonly perPage?: number
  readonly markReadOnOpen?: boolean
  /** Pede a página ao servidor em vez de fatiar no cliente. */
  readonly serverPaginated?: boolean
  /** Conversa a abrir na montagem (deep link `?id=`). */
  readonly initialConversationId?: string | undefined
  /** Idem, pelo telefone — é o que costuma vir no link de um alerta ou de um pedido. */
  readonly initialWhatsappNumber?: string | undefined
  readonly simulator?: ConversationsWorkspaceSimulator
  readonly quickReplies?: readonly QuickReply[]
  readonly quickReplyVariablesFor?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => Record<string, string>
  /** Etapa do fluxo mostrada no painel de contexto. */
  readonly flowLabelOf?: (conversation: ConversationSummary) => string | undefined
  /** Substitui o download local do transcript (ex.: exportação completa pela rota do servidor). */
  readonly onDownload?: (conversation: ConversationSummary) => void
  /** Bloqueia o composer enquanto a conversa estiver com o bot. */
  readonly requireTakeoverToReply?: boolean
  /** Deixa marcar mensagens no transcript e copiar o trecho. */
  readonly messageSelection?: boolean
  /** Texto já no campo ao abrir a conversa (deep link que sugere a resposta). */
  readonly initialComposerText?: string | undefined
  /** `rich` troca o campo simples pelo texto com a formatação do WhatsApp desenhada ao escrever. */
  readonly composer?: 'simple' | 'rich'
  /** Valores que o operador insere sem digitar. Só o composer `rich` os oferece. */
  readonly composerVariablesFor?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => readonly RichComposerVariable[]
  /** Fila de anexos com legenda, como no WhatsApp. Ausente, o clipe manda cada arquivo na hora. */
  readonly onSendAttachments?: (
    conversation: ConversationSummary,
    files: readonly File[],
    caption: string,
  ) => Promise<void>
  /** Nota de voz. Ausente, o microfone não aparece. */
  readonly onRecordAudio?: (conversation: ConversationSummary, file: File) => Promise<void>
  readonly contextEntriesOf?: (context: Record<string, unknown> | undefined) => readonly ConversationContextEntry[]
  readonly onAttach?: (conversation: ConversationSummary, file: File) => Promise<void>
  readonly extraUtilitiesFor?: (conversation: ConversationSummary) => readonly ConversationHeaderUtility[]
  readonly renderFilters?: (inbox: UseConversationsInboxResult) => ReactNode
  readonly renderBulkActions?: (inbox: UseConversationsInboxResult) => ReactNode
  readonly renderRow?: (conversation: ConversationSummary) => ReactNode
  readonly renderAboveTranscript?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => ReactNode
  readonly renderHeaderActions?: (inbox: UseConversationsInboxResult) => ReactNode
  readonly onSendTemplateToSelected?: (inbox: UseConversationsInboxResult) => void
  /** Destino do link de reentrar no painel, mostrado junto do aviso de sessão expirada. */
  readonly signInHref?: string
  readonly className?: string
}

export function ConversationsWorkspace({
  labels: labelsOverride,
  filters,
  perPage,
  markReadOnOpen,
  serverPaginated,
  initialConversationId,
  initialWhatsappNumber,
  simulator,
  quickReplies,
  quickReplyVariablesFor,
  flowLabelOf,
  onDownload,
  requireTakeoverToReply,
  messageSelection,
  initialComposerText,
  composer,
  composerVariablesFor,
  onSendAttachments,
  onRecordAudio,
  contextEntriesOf,
  onAttach,
  extraUtilitiesFor,
  renderFilters,
  renderBulkActions,
  renderRow,
  renderAboveTranscript,
  renderHeaderActions,
  onSendTemplateToSelected,
  signInHref,
  className,
}: ConversationsWorkspaceProps) {
  const labels = { ...DEFAULT_CONVERSATIONS_WORKSPACE_LABELS, ...labelsOverride }
  const inbox = useConversationsInbox({
    ...(filters ? { filters } : {}),
    ...(perPage ? { perPage } : {}),
    ...(markReadOnOpen === undefined ? {} : { markReadOnOpen }),
    ...(serverPaginated ? { serverPaginated } : {}),
  })
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [openedFromLink, setOpenedFromLink] = useState<string | undefined>(undefined)

  // Só seleciona depois que a conversa aparece na lista: o hook limpa qualquer seleção que não
  // esteja em `conversations`, e no primeiro render a lista ainda está vazia.
  useEffect(() => {
    const link = initialConversationId ?? initialWhatsappNumber
    if (!link || openedFromLink === link) return
    const target = inbox.conversations.find(
      (conversation) =>
        conversation.id === initialConversationId || conversation.whatsappNumber === initialWhatsappNumber,
    )
    if (!target) return
    inbox.selectConversation(target.id)
    setOpenedFromLink(link)
  }, [initialConversationId, initialWhatsappNumber, openedFromLink, inbox])

  const selected = inbox.selectedConversation
  const simulatorEnabled = Boolean(simulator && (simulator.enabled ?? true))
  const showSimulator = simulatorEnabled && simulatorOpen && Boolean(selected)

  const paneUtilities = useMemo(() => {
    if (!selected) return undefined
    const fromProduct = extraUtilitiesFor?.(selected) ?? []
    if (!simulatorEnabled) return fromProduct
    // No cabeçalho da conversa, ao lado de "Assumir atendimento": o simulador age sobre ESTA
    // conversa; no cabeçalho da página ele parecia um filtro da inbox.
    return [
      ...fromProduct,
      {
        key: 'simulator',
        icon: simulator?.icon ?? '🧪',
        label: simulator?.label ?? 'Simular cliente',
        active: simulatorOpen,
        run: () => setSimulatorOpen((open) => !open),
      },
    ]
  }, [selected, extraUtilitiesFor, simulatorEnabled, simulator, simulatorOpen])

  return (
    <div className={`cv-workspace${className ? ` ${className}` : ''}`}>
      {/* Cabeçalho denso em tela estreita: ícone + número. O rótulo escrito ocupava três linhas em
          375px e empurrava a lista para fora da tela. */}
      <header className="cv-workspace-header">
        <div className="cv-workspace-header__titles">
          <h1>{labels.title}</h1>
          <p>
            <span title={labels.conversations}>
              💬 {inbox.totalCount}
              <span className="cv-only-wide"> {labels.conversations}</span>
            </span>
            <span title={labels.waiting} className="cv-workspace-header__waiting">
              ⏳ {inbox.waitingCount}
              <span className="cv-only-wide"> {labels.waiting}</span>
            </span>
            <span title={labels.unread}>
              ✉️ {inbox.unreadCount}
              <span className="cv-only-wide"> {labels.unread}</span>
            </span>
          </p>
        </div>

        <div className="cv-workspace-header__actions">
          <button
            type="button"
            onClick={() => inbox.setWaitingOnly(!inbox.waitingOnly)}
            aria-pressed={inbox.waitingOnly}
            title={labels.waitingOnly}
            className={inbox.waitingOnly ? 'cv-workspace-toggle cv-workspace-toggle--on' : 'cv-workspace-toggle'}
          >
            ⏳<span className="cv-only-wide"> {labels.waitingOnly}</span>
          </button>
          {/* O contador só aparece com seleção: " (0)" era texto morto ao lado do ícone. */}
          <button
            type="button"
            onClick={() => void inbox.markSelectedAsRead()}
            disabled={inbox.selectedIds.size === 0 || inbox.busy}
            title={labels.markSelectedAsRead}
            aria-label={labels.markSelectedAsRead}
            className="cv-workspace-toggle"
          >
            ✓<span className="cv-only-wide"> {labels.markSelectedAsRead}</span>
            {inbox.selectedIds.size > 0 ? ` (${inbox.selectedIds.size})` : ''}
          </button>
          {/* Só com não lida na tela e só onde o host implementa a rota: sem isso o botão zerava
              nada e ainda assim ocupava o cabeçalho. */}
          {inbox.canMarkAllRead && inbox.unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void inbox.markAllAsRead()}
              disabled={inbox.busy}
              title={labels.markAllAsRead}
              className="cv-workspace-toggle"
            >
              ✓✓<span className="cv-only-wide"> {labels.markAllAsRead}</span>
            </button>
          ) : null}
          {renderHeaderActions?.(inbox)}
        </div>
      </header>

      {/* Silêncio aqui foi o que fez "não existe nenhuma conversa" parecer perda de dados: sem
          sessão a API responde 401, a lista vem vazia e a tela não dizia nada. */}
      {inbox.loadFailure ? (
        <p role="alert" className="cv-workspace-failure">
          {inbox.loadFailure}
          {signInHref ? (
            <>
              {' '}
              <a href={signInHref} className="cv-workspace-failure__link">
                {labels.signIn}
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {/* Master/detail: em tela estreita a grade empilhava lista e conversa na mesma altura fixa e
          cada uma virava uma fatia inútil — abaixo de `lg` mostra uma ou outra. As três colunas só
          convivem a partir de `xl`; entre `lg` e `xl` a lista sai, porque enquanto se testa UMA
          conversa é ela que menos importa. Cada coluna é um cartão com respiro entre elas:
          separação por espaço lê mais rápido que por borda. */}
      <div
        className={`cv-workspace-grid${showSimulator ? ' cv-workspace-grid--with-simulator' : ''}`}
        data-detail={selected ? 'open' : 'closed'}
      >
        <ConversationsInboxList
          inbox={inbox}
          labels={labels}
          className="cv-workspace-list"
          {...(renderFilters ? { renderFilters } : {})}
          {...(renderBulkActions ? { renderBulkActions } : {})}
          {...(renderRow ? { renderRow } : {})}
          {...(onSendTemplateToSelected
            ? { onSendTemplateToSelected: () => onSendTemplateToSelected(inbox) }
            : inbox.canListTemplates
              ? { onSendTemplateToSelected: () => setTemplateModalOpen(true) }
              : {})}
        />

        {/* `section`, não `main`: o layout do host já provê o `main` da página. */}
        <section className="cv-workspace-detail">
          {selected ? (
            <ConversationPane
              conversation={selected}
              now={inbox.now}
              busy={inbox.busy}
              labels={labels}
              {...(inbox.canTakeover ? { onTakeover: () => void inbox.takeover(selected.id) } : {})}
              {...(inbox.canTakeover ? { onReturnToBot: () => void inbox.releaseToBot(selected.id) } : {})}
              {...(inbox.canFinalize ? { onFinish: () => void inbox.finalize(selected.id) } : {})}
              {...(flowLabelOf ? { flowLabel: flowLabelOf(selected) } : {})}
              {...(onDownload ? { onDownload: () => onDownload(selected) } : {})}
              {...(requireTakeoverToReply ? { requireTakeoverToReply } : {})}
              {...(messageSelection ? { messageSelection } : {})}
              {...(initialComposerText ? { initialComposerText } : {})}
              {...(composer ? { composer } : {})}
              {...(composerVariablesFor ? { composerVariablesFor } : {})}
              {...(onSendAttachments
                ? {
                    onSendAttachments: (files: readonly File[], caption: string) =>
                      onSendAttachments(selected, files, caption),
                  }
                : {})}
              {...(onRecordAudio ? { onRecordAudio: (file: File) => onRecordAudio(selected, file) } : {})}
              onBack={inbox.clearSelection}
              {...(paneUtilities ? { extraUtilities: paneUtilities } : {})}
              {...(contextEntriesOf ? { contextEntriesOf } : {})}
              {...(quickReplies ? { quickReplies } : {})}
              {...(quickReplyVariablesFor ? { quickReplyVariablesFor } : {})}
              {...(renderAboveTranscript ? { renderAboveTranscript } : {})}
              {...(onAttach ? { onAttach: (file: File) => onAttach(selected, file) } : {})}
            />
          ) : (
            <p className="cv-workspace-empty">{labels.emptyDetail}</p>
          )}
        </section>

        {showSimulator && selected ? (
          // `min-height:0` junto do `min-width:0`: sem isso a linha do grid cresce com o conteúdo do
          // painel, o scroll interno nunca ativa e quem rola passa a ser a página inteira.
          <div className="cv-workspace-simulator">
            {simulator?.render({ conversationId: selected.id, close: () => setSimulatorOpen(false) })}
          </div>
        ) : null}
      </div>

      {templateModalOpen ? (
        <BulkTemplateModal
          labels={labels}
          expiredCount={inbox.expiredSelectedCount}
          sending={inbox.busy}
          onClose={() => setTemplateModalOpen(false)}
          onSend={(templateName) => {
            void inbox.sendTemplateToSelected(templateName).then(() => setTemplateModalOpen(false))
          }}
        />
      ) : null}
    </div>
  )
}
