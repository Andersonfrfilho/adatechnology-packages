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
 *
 * O simulador é montado aqui, e não pelo host: com `simulator.transports` o produto entrega só o
 * transporte de cada canal e a moldura vem do pacote. Isso traz o `preview/` para o bundle de quem
 * usa o workspace — o preço de a tela composta ser o padrão de consumo, que é o que impede a inbox
 * de divergir entre produtos.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, CheckCheck, FlaskConical, Hourglass, Mail, MessagesSquare, UserPlus } from 'lucide-react'

import { ICON_SIZE_ACTION, ICON_SIZE_INLINE } from '../icon.constant'
import type { ConversationContextEntry, ConversationContextPanelLabels } from '../ConversationContextPanel'
import type { ConversationHeaderUtility } from '../ConversationHeader'
import type { QuickReply } from '../MessageComposer'
import type { RichComposerVariable } from '../RichMessageComposer'
import type { ConversationSummary } from '../providers/types'
import { useConversations } from '../providers/ConversationsProvider'
import { DEFAULT_CONVERSATION_CHANNEL, formatContactHandle, type ConversationChannel } from '../conversationChannel'
import type { ConversationSimulatorClient } from '../preview/ConversationSimulatorClient'
import type { PreviewUploadedMedia } from '../preview/createPreviewMediaUploader'
import {
  ConversationSimulatorPanel,
  type ConversationSimulatorPanelLabels,
} from '../preview/ConversationSimulatorPanel'
import { BulkTemplateModal } from './BulkTemplateModal'
import { ConversationPane } from './ConversationPane'
import { ConversationsInboxList } from './ConversationsInboxList'
import { DEFAULT_CONVERSATIONS_WORKSPACE_LABELS, type ConversationsWorkspaceLabels } from './labels'
import { useConversationsInbox, type UseConversationsInboxResult } from './useConversationsInbox'
import { TooltipLayer } from '../Tooltip'
import type { ConversationVariable } from '../quickReplies/quickReply.types'

export type SimulatorTransportParams = {
  readonly conversationId: string
  readonly channel: ConversationChannel
  /** Identificador do contato no canal: telefone no WhatsApp, id de sessão no chat do site. */
  readonly handle: string
}

/**
 * Fábrica do transporte daquele canal.
 *
 * É o único ponto onde o host precisa saber de canal: o painel, a moldura e o comportamento são os
 * mesmos em todos. No WhatsApp devolve o cliente-ponte (assinatura no servidor do host); no chat do
 * site, o cliente das rotas do widget.
 */
export type SimulatorTransportFactory = (params: SimulatorTransportParams) => ConversationSimulatorClient

/**
 * Contato de teste que o host cria para abrir o simulador sem conversa selecionada. `handle` é o
 * identificador no canal (no WhatsApp, um número de teste começando com `0`, que nenhum país usa).
 */
export type SimulatorTestContact = {
  readonly handle: string
  /** Ausente = WhatsApp. */
  readonly channel?: ConversationChannel
  /** Id da conversa quando o host já o conhece. Ausente, usa `handle` e o transcript começa vazio. */
  readonly conversationId?: string
}

export interface ConversationsWorkspaceSimulator {
  /**
   * Um transporte por canal — o workspace monta o painel com o da conversa selecionada.
   *
   * Canal sem transporte não desenha o botão: capacidade é opcional por ausência, e oferecer
   * "simular" numa conversa que não tem como receber a mensagem é um botão que falha ao ser tocado.
   */
  readonly transports?: Partial<Record<ConversationChannel, SimulatorTransportFactory>>
  /**
   * Válvula de escape: o host desenha o painel inteiro. Tem precedência sobre `transports`.
   *
   * Era a única porta antes de `transports`, quando o simulador só falava WhatsApp e cada produto
   * remontava a moldura — o que fez duas telas da mesma casa divergirem. Continua aceito para não
   * quebrar quem já a usa.
   */
  render?(params: { conversationId: string; channel: ConversationChannel; close: () => void }): ReactNode
  /** Ausente = ligado. Serve para esconder fora de desenvolvimento sem condicionar o JSX. */
  readonly enabled?: boolean
  /** Ícone da biblioteca (lucide) no utilitário do cabeçalho. Ausente, entra o frasco de teste. */
  readonly icon?: ReactNode
  readonly label?: string
  /** Vocabulário do painel. O que muda de canal (destino, placeholder) já vem resolvido. */
  readonly labels?: Partial<ConversationSimulatorPanelLabels>
  /** Destino do upload no canal que entrega mídia por referência (o caminho da Meta). */
  readonly uploadMedia?: (file: File) => Promise<PreviewUploadedMedia>
  /** Recarrega o transcript a cada N ms. Serve a host sem stream. */
  readonly pollIntervalMs?: number
  /**
   * Liga "Novo contato de teste" no cabeçalho da página: o host devolve o contato e o simulador
   * abre sem conversa selecionada. Quando a conversa dele aparece na lista, ela é selecionada.
   * Ausente, o simulador só abre sobre uma conversa existente.
   */
  readonly createTestContact?: () => SimulatorTestContact | Promise<SimulatorTestContact>
  /** Rótulo do botão de novo contato. Padrão: "Novo contato de teste". */
  readonly newContactLabel?: string
  /**
   * Liga "Reiniciar conversa" no cabeçalho do painel: o host apaga a sessão e o que foi coletado do
   * contato de teste (só onde há simulador; nunca em produção). Depois o painel recomeça vazio e
   * manda `restartText`, que leva o robô ao menu. Ausente, o botão não existe.
   */
  readonly resetConversation?: (params: SimulatorTransportParams) => Promise<void>
  /** Rótulo do botão de reinício. Padrão: "Reiniciar conversa". */
  readonly resetLabel?: string
  /** O que o contato de teste "diz" ao recomeçar. Padrão: "menu". */
  readonly restartText?: string
}

const DEFAULT_SIMULATOR_RESET_LABEL = 'Reiniciar conversa'
const DEFAULT_SIMULATOR_RESTART_TEXT = 'menu'

type SimulatorTarget = {
  readonly key: string
  readonly conversationId: string
  readonly channel: ConversationChannel
  readonly handle: string
  /** `false` enquanto a conversa do contato de teste ainda não existe no servidor. */
  readonly persisted: boolean
}

function handleOf(conversation: ConversationSummary): string {
  return conversation.contactId ?? conversation.whatsappNumber
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
  /** @deprecated Use `conversationVariablesFor`, que alimenta os dois composers com uma lista só. */
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
  /**
   * Valores que o operador insere sem digitar. Só o composer `rich` os oferece.
   * @deprecated Use `conversationVariablesFor`.
   */
  readonly composerVariablesFor?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => readonly RichComposerVariable[]
  /**
   * Dados da conversa que o texto pode citar, numa lista só. Presente, manda sobre
   * `quickReplyVariablesFor` e `composerVariablesFor`.
   */
  readonly conversationVariablesFor?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => readonly ConversationVariable[]
  /** Fila de anexos com legenda, como no WhatsApp. Ausente, o clipe manda cada arquivo na hora. */
  readonly onSendAttachments?: (
    conversation: ConversationSummary,
    files: readonly File[],
    caption: string,
  ) => Promise<void>
  /** Nota de voz. Ausente, o microfone não aparece. */
  readonly onRecordAudio?: (conversation: ConversationSummary, file: File) => Promise<void>
  readonly contextEntriesOf?: (context: Record<string, unknown> | undefined) => readonly ConversationContextEntry[]
  /** Vocabulário do painel de contexto (`title`, `empty`, `notCollected`...). */
  readonly contextLabels?: Partial<ConversationContextPanelLabels>
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
  conversationVariablesFor,
  onSendAttachments,
  onRecordAudio,
  contextEntriesOf,
  contextLabels,
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
  const [testContact, setTestContact] = useState<SimulatorTestContact | undefined>(undefined)
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

  // O contato de teste vira conversa de verdade no primeiro envio; achando-a na lista, ela passa a
  // ser a selecionada e o painel segue sobre ela.
  useEffect(() => {
    if (!testContact) return
    const created = inbox.conversations.find((conversation) => handleOf(conversation) === testContact.handle)
    if (!created) return
    inbox.selectConversation(created.id)
    setTestContact(undefined)
  }, [testContact, inbox])

  const conversations = useConversations()
  const target: SimulatorTarget | undefined = selected
    ? {
        key: selected.id,
        conversationId: selected.id,
        channel: selected.channel ?? DEFAULT_CONVERSATION_CHANNEL,
        handle: handleOf(selected),
        persisted: true,
      }
    : testContact
      ? {
          key: `test-contact:${testContact.handle}`,
          // Sem id conhecido, o próprio identificador: é a chave do stream por conversa (`conv:<número>`).
          conversationId: testContact.conversationId ?? testContact.handle,
          channel: testContact.channel ?? DEFAULT_CONVERSATION_CHANNEL,
          handle: testContact.handle,
          persisted: testContact.conversationId !== undefined,
        }
      : undefined
  const channel = target?.channel ?? DEFAULT_CONVERSATION_CHANNEL
  const targetConversationId = target?.conversationId
  const handle = target?.handle ?? ''
  const transport = simulator?.transports?.[channel]
  const simulatorAvailable = Boolean(simulator && (simulator.enabled ?? true))
  const simulatorEnabled = simulatorAvailable && Boolean(simulator?.render ?? transport)
  const showSimulator = simulatorEnabled && simulatorOpen && Boolean(target)
  const canCreateTestContact = simulatorAvailable && Boolean(simulator?.createTestContact)

  // O transporte é recriado só quando a conversa (ou o canal dela) muda: identidade nova a cada
  // render reiniciaria a leitura do transcript dentro do painel a cada digitação.
  const simulatorClient = useMemo(
    () =>
      transport && targetConversationId !== undefined
        ? transport({ conversationId: targetConversationId, channel, handle })
        : undefined,
    [transport, targetConversationId, channel, handle],
  )

  async function handleCreateTestContact(): Promise<void> {
    const contact = await simulator?.createTestContact?.()
    if (!contact) return
    inbox.clearSelection()
    setTestContact(contact)
    setSimulatorOpen(true)
  }

  async function handleResetConversation(): Promise<void> {
    if (!target || !simulator?.resetConversation) return
    await simulator.resetConversation({ conversationId: target.conversationId, channel: target.channel, handle: target.handle })
    inbox.clearSelection()
    await inbox.refetch()
    setTestContact({ handle: target.handle, channel: target.channel })
    await simulatorClient?.sendText(simulator.restartText ?? DEFAULT_SIMULATOR_RESTART_TEXT)
  }

  function closeSimulator(): void {
    setSimulatorOpen(false)
    setTestContact(undefined)
  }

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
        icon: simulator?.icon ?? <FlaskConical size={ICON_SIZE_ACTION} />,
        label: simulator?.label ?? 'Simular cliente',
        active: simulatorOpen,
        run: () => setSimulatorOpen((open) => !open),
      },
    ]
  }, [selected, extraUtilitiesFor, simulatorEnabled, simulator, simulatorOpen])

  return (
    <div className={`cv-workspace${className ? ` ${className}` : ''}`}>
      <TooltipLayer />
      {/* Cabeçalho denso em tela estreita: ícone + número. O rótulo escrito ocupava três linhas em
          375px e empurrava a lista para fora da tela. */}
      <header className="cv-workspace-header">
        <div className="cv-workspace-header__titles">
          <h1>{labels.title}</h1>
          <p>
            <span data-cv-tooltip={labels.conversations} className="cv-stat">
              <MessagesSquare size={ICON_SIZE_INLINE} aria-hidden="true" /> {inbox.totalCount}
              <span className="cv-only-wide"> {labels.conversations}</span>
            </span>
            <span data-cv-tooltip={labels.waiting} className="cv-stat cv-workspace-header__waiting">
              <Hourglass size={ICON_SIZE_INLINE} aria-hidden="true" /> {inbox.waitingCount}
              <span className="cv-only-wide"> {labels.waiting}</span>
            </span>
            <span data-cv-tooltip={labels.unread} className="cv-stat">
              <Mail size={ICON_SIZE_INLINE} aria-hidden="true" /> {inbox.unreadCount}
              <span className="cv-only-wide"> {labels.unread}</span>
            </span>
          </p>
        </div>

        <div className="cv-workspace-header__actions">
          <button
            type="button"
            onClick={() => inbox.setWaitingOnly(!inbox.waitingOnly)}
            aria-pressed={inbox.waitingOnly}
            data-cv-tooltip={labels.waitingOnly} aria-label={labels.waitingOnly}
            className={inbox.waitingOnly ? 'cv-workspace-toggle cv-workspace-toggle--on' : 'cv-workspace-toggle'}
          >
            <Hourglass size={ICON_SIZE_ACTION} aria-hidden="true" />
            <span className="cv-only-wide">{labels.waitingOnly}</span>
          </button>
          {/* O contador só aparece com seleção: " (0)" era texto morto ao lado do ícone. */}
          <button
            type="button"
            onClick={() => void inbox.markSelectedAsRead()}
            disabled={inbox.selectedIds.size === 0 || inbox.busy}
            data-cv-tooltip={labels.markSelectedAsRead}
            aria-label={labels.markSelectedAsRead}
            className="cv-workspace-toggle"
          >
            <Check size={ICON_SIZE_ACTION} aria-hidden="true" />
            <span className="cv-only-wide">{labels.markSelectedAsRead}</span>
            {inbox.selectedIds.size > 0 ? <span>({inbox.selectedIds.size})</span> : null}
          </button>
          {/* Só com não lida na tela e só onde o host implementa a rota: sem isso o botão zerava
              nada e ainda assim ocupava o cabeçalho. */}
          {inbox.canMarkAllRead && inbox.unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void inbox.markAllAsRead()}
              disabled={inbox.busy}
              data-cv-tooltip={labels.markAllAsRead} aria-label={labels.markAllAsRead}
              className="cv-workspace-toggle"
            >
              <CheckCheck size={ICON_SIZE_ACTION} aria-hidden="true" />
              <span className="cv-only-wide">{labels.markAllAsRead}</span>
            </button>
          ) : null}
          {canCreateTestContact ? (
            <button
              type="button"
              onClick={() => void handleCreateTestContact()}
              data-cv-tooltip={simulator?.newContactLabel ?? labels.newTestContact}
              aria-label={simulator?.newContactLabel ?? labels.newTestContact}
              className="cv-workspace-toggle"
            >
              <UserPlus size={ICON_SIZE_ACTION} aria-hidden="true" />
              <span className="cv-only-wide">{simulator?.newContactLabel ?? labels.newTestContact}</span>
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
        data-detail={selected || showSimulator ? 'open' : 'closed'}
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
              {...(inbox.canTakeover ? { onTakeover: () => inbox.takeover(selected.id) } : {})}
              {...(inbox.canTakeover ? { onReturnToBot: () => void inbox.releaseToBot(selected.id) } : {})}
              {...(inbox.canFinalize ? { onFinish: () => void inbox.finalize(selected.id) } : {})}
              {...(flowLabelOf ? { flowLabel: flowLabelOf(selected) } : {})}
              {...(onDownload ? { onDownload: () => onDownload(selected) } : {})}
              {...(requireTakeoverToReply ? { requireTakeoverToReply } : {})}
              {...(messageSelection ? { messageSelection } : {})}
              {...(initialComposerText ? { initialComposerText } : {})}
              {...(composer ? { composer } : {})}
              {...(composerVariablesFor ? { composerVariablesFor } : {})}
              {...(conversationVariablesFor ? { conversationVariablesFor } : {})}
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
              {...(contextLabels ? { contextLabels } : {})}
              {...(quickReplies ? { quickReplies } : {})}
              {...(quickReplyVariablesFor ? { quickReplyVariablesFor } : {})}
              {...(renderAboveTranscript ? { renderAboveTranscript } : {})}
              {...(onAttach ? { onAttach: (file: File) => onAttach(selected, file) } : {})}
            />
          ) : (
            <p className="cv-workspace-empty">{labels.emptyDetail}</p>
          )}
        </section>

        {showSimulator && target ? (
          // `min-height:0` junto do `min-width:0`: sem isso a linha do grid cresce com o conteúdo do
          // painel, o scroll interno nunca ativa e quem rola passa a ser a página inteira.
          <div className="cv-workspace-simulator">
            {simulator?.render ? (
              simulator.render({ conversationId: target.conversationId, channel, close: closeSimulator })
            ) : simulatorClient && conversations ? (
              // `key` pela conversa: trocar de contato sem remontar deixaria o transcript e o campo
              // de texto do contato anterior na tela.
              <ConversationSimulatorPanel
                key={target.key}
                client={simulatorClient}
                sse={conversations.sse}
                conversationId={target.conversationId}
                channel={channel}
                displayHandle={formatContactHandle({ handle, channel })}
                // Contato de teste sem conversa ainda: nada a ler. O eco local mostra o que foi
                // enviado até a conversa aparecer na lista e o painel passar para ela.
                loadMessages={(conversationId) =>
                  target.persisted ? conversations.api.fetchMessages(conversationId) : Promise.resolve([])
                }
                onClose={closeSimulator}
                {...(simulator?.resetConversation
                  ? {
                      headerActions: (
                        <button type="button" className="cv-simulator-panel__action" onClick={() => void handleResetConversation()}>
                          {simulator.resetLabel ?? DEFAULT_SIMULATOR_RESET_LABEL}
                        </button>
                      ),
                    }
                  : {})}
                {...(simulator?.labels ? { labels: simulator.labels } : {})}
                {...(simulator?.uploadMedia ? { uploadMedia: simulator.uploadMedia } : {})}
                {...(simulator?.pollIntervalMs ? { pollIntervalMs: simulator.pollIntervalMs } : {})}
              />
            ) : null}
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
