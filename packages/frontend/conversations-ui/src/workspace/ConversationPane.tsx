/**
 * Coluna do meio: cabeçalho, contexto, documentos, transcript e composer da conversa aberta.
 *
 * Era a peça mais copiada entre os produtos, e a que mais divergia: um perdia o salto para a
 * última mensagem, outro engolia falha de anexo, outro não abria a biblioteca de arquivos.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { AudioRecorderButton } from '../AudioRecorderButton'
import { ConversationContextPanel, type ConversationContextEntry } from '../ConversationContextPanel'
import { ConversationDocumentsPanel } from '../ConversationDocumentsPanel'
import { ConversationHeader, type ConversationHeaderUtility } from '../ConversationHeader'
import { ConversationWallpaper } from '../Wallpaper'
import { DateDivider } from '../DateDivider'
import { MessageBubble } from '../MessageBubble'
import { MessageComposer, applyQuickReplyVariables, type QuickReply } from '../MessageComposer'
import { RichMessageComposer, type RichComposerVariable } from '../RichMessageComposer'
import { WindowExpiredNotice, isWindowBlocking } from '../WindowExpiredNotice'
import { windowOf } from '../conversationWindow'
import { buildTranscriptFilename, buildTranscriptText, downloadTextFile } from '../conversationTranscript'
import { useConversationContext } from '../hooks/useConversationContext'
import { useConversationMessages } from '../hooks/useConversationMessages'
import { useConversationRealtime } from '../hooks/useConversationRealtime'
import { useScrollToLatestMessage } from '../hooks/useScrollToLatestMessage'
import { useConversations } from '../providers/ConversationsProvider'
import type { ConversationSummary } from '../providers/types'
import type { ConversationsWorkspaceLabels } from './labels'
import type {
  ConversationVariable,
  QueuedAttachment,
  QuickReply as SavedQuickReply,
} from '../quickReplies/quickReply.types'
import {
  attachmentKey,
  queuedAttachmentsFromQuickReply,
  resolveIdempotencyKey,
  retryStoredAttachments,
  sendQueuedMessage,
  type AttachmentSendStatus,
  type IdempotencyKeyState,
} from '../quickReplies/quickReplyAttachments'
import { resolveConversationVariables } from '../quickReplies/resolveConversationVariables'
import { QueuedAttachmentsList } from './QueuedAttachmentsList'

export interface ConversationPaneProps {
  readonly conversation: ConversationSummary
  readonly now: number
  readonly busy: boolean
  readonly labels: ConversationsWorkspaceLabels
  /** Devolve a promessa quando o host a tem: o envio de template espera a tomada antes de sair. */
  readonly onTakeover?: (() => void | Promise<void>) | undefined
  readonly onReturnToBot?: (() => void) | undefined
  readonly onFinish?: (() => void) | undefined
  readonly onBack: () => void
  readonly extraUtilities?: readonly ConversationHeaderUtility[]
  /** Traduz o contexto cru do produto nas linhas do painel. Ausente, o painel não aparece. */
  readonly contextEntriesOf?: (context: Record<string, unknown> | undefined) => readonly ConversationContextEntry[]
  readonly quickReplies?: readonly QuickReply[]
  /**
   * Recebe o contexto junto porque o dado que interessa à variável (o nome que o bot perguntou,
   * por exemplo) vive no contexto do fluxo, não no resumo da listagem.
   */
  /** @deprecated Use `conversationVariablesFor`, que alimenta os dois composers com uma lista só. */
  readonly quickReplyVariablesFor?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => Record<string, string>
  /** Etapa do fluxo ao lado do contexto (ex.: "Anotando o pedido"). */
  readonly flowLabel?: string | undefined
  /**
   * Substitui o download local do transcript. Existe para o produto que exporta pela rota do
   * servidor, onde o arquivo sai completo em vez de só com o que a tela carregou.
   */
  readonly onDownload?: (() => void) | undefined
  /**
   * Bloqueia o composer enquanto a conversa estiver com o bot. Ligado, responder sem assumir
   * atropelaria o fluxo automático no meio de uma pergunta.
   */
  readonly requireTakeoverToReply?: boolean
  /**
   * Deixa marcar mensagens e copiar o trecho. É o que se faz para levar um pedaço da conversa a um
   * e-mail ou a um chamado, sem baixar o transcript inteiro.
   */
  readonly messageSelection?: boolean
  /** Texto já no campo ao abrir (deep link que sugere a resposta). */
  readonly initialComposerText?: string | undefined
  /**
   * Peça do produto entre o contexto e o transcript (ex.: ficha do lead, resumo do pedido). Recebe o
   * contexto do fluxo junto: é dele que sai o resumo, e sem isso o host teria de buscá-lo de novo.
   */
  readonly renderAboveTranscript?: (
    conversation: ConversationSummary,
    context: Record<string, unknown> | undefined,
  ) => ReactNode
  readonly onAttach?: ((file: File) => Promise<void>) | undefined
  /**
   * `rich` troca o `textarea` pelo campo com a formatação do WhatsApp desenhada enquanto se escreve.
   * Vale onde o atendente manda texto longo e formatado; para responder "já vou ver" o campo simples
   * é menos coisa na tela.
   */
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
  /**
   * Fila de anexos com legenda, como no WhatsApp: os arquivos escolhidos ficam visíveis acima da
   * barra e saem junto com o texto escrito. Ausente, o clipe manda cada arquivo na hora — o que
   * perde a legenda, e era a diferença entre as telas.
   */
  readonly onSendAttachments?: (files: readonly File[], caption: string) => Promise<void>
  /** Grava e envia nota de voz. Ausente, o microfone não aparece. */
  readonly onRecordAudio?: (file: File) => Promise<void>
}

export function ConversationPane({
  conversation,
  now,
  busy,
  labels,
  onTakeover,
  onReturnToBot,
  onFinish,
  onBack,
  extraUtilities,
  contextEntriesOf,
  quickReplies,
  quickReplyVariablesFor,
  flowLabel,
  onDownload,
  requireTakeoverToReply,
  messageSelection,
  initialComposerText,
  renderAboveTranscript,
  onAttach,
  composer = 'simple',
  composerVariablesFor,
  conversationVariablesFor,
  onSendAttachments,
  onRecordAudio,
}: ConversationPaneProps) {
  const context = useConversations()
  if (!context) {
    throw new Error('ConversationPane requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  const { messages, refetch } = useConversationMessages(conversation.id)
  const { context: conversationContext } = useConversationContext(conversation.id)
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [sendFailure, setSendFailure] = useState<string | undefined>(undefined)
  const [selectedMessageIds, setSelectedMessageIds] = useState<ReadonlySet<string>>(new Set())
  const [draft, setDraft] = useState(initialComposerText ?? '')
  const [queue, setQueue] = useState<readonly QueuedAttachment[]>([])
  const [attachmentStatus, setAttachmentStatus] = useState<Record<string, AttachmentSendStatus>>({})
  const [isSendingDraft, setIsSendingDraft] = useState(false)
  /** Ref, não estado: entre dois cliques seguidos o React ainda não teria repintado a trava. */
  const sendInFlightRef = useRef(false)
  /**
   * Uma por conjunto de `uploadId` guardado em voo (QR-38, M3): `resolveIdempotencyKey` decide se a
   * chave de `handleRichSend` sobrevive ao reenvio do que sobrou, ou se precisa de uma nova porque o
   * conjunto mudou.
   */
  const idempotencyKeyRef = useRef<IdempotencyKeyState | undefined>(undefined)
  /** A mesma decisão, mas para o "Tentar de novo" de um item avulso — nunca a mesma chave do envio
   * do rascunho, porque o conjunto de `uploadId` de um retry solo é sempre outro (M3). */
  const retryIdempotencyKeyRef = useRef<IdempotencyKeyState | undefined>(undefined)
  /**
   * Espelha `conversation.id` sem esperar o repaint: um envio em andamento lê isto depois do
   * `await` para saber se o atendente já trocou de conversa (H2) — `conversation.id` capturado no
   * fechamento seria sempre o da conversa em que o clique aconteceu, nunca o atual.
   */
  const currentConversationIdRef = useRef(conversation.id)
  /**
   * Uma promessa por `uploadId`, nunca duas: sem o cache, cada render da lista de anexos disparava
   * de novo a URL assinada do mesmo arquivo (M4) — a função abaixo é estável, mas o item pode
   * remontar por causa do estado de envio.
   */
  const thumbnailUrlCacheRef = useRef(new Map<string, Promise<string>>())
  const getQueuedAttachmentThumbnailUrl = useCallback(
    (uploadId: string): Promise<string> => {
      const cached = thumbnailUrlCacheRef.current.get(uploadId)
      if (cached) return cached
      const pending = api.getDocumentUrl(uploadId, 'inline')
      thumbnailUrlCacheRef.current.set(uploadId, pending)
      pending.catch(() => thumbnailUrlCacheRef.current.delete(uploadId))
      return pending
    },
    [api],
  )

  // Trocar de conversa zera as duas coisas: seleção de mensagem e rascunho pertencem à thread, e
  // levá-los adiante faria copiar o trecho errado ou responder ao cliente errado. O envio em
  // andamento da conversa anterior também é abandonado: sem isto, a resposta chegando depois da
  // troca reabilitaria o composer errado ou reusaria a chave de idempotência de outra thread.
  useEffect(() => {
    currentConversationIdRef.current = conversation.id
    setSelectedMessageIds(new Set())
    setDraft(initialComposerText ?? '')
    setQueue([])
    setAttachmentStatus({})
    idempotencyKeyRef.current = undefined
    retryIdempotencyKeyRef.current = undefined
    sendInFlightRef.current = false
    setIsSendingDraft(false)
  }, [conversation.id, initialComposerText])

  function toggleMessageSelected(messageId: string): void {
    setSelectedMessageIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  /** Data, quem falou e o texto: fora do painel o trecho precisa se sustentar sozinho. */
  function copySelectedMessages(): void {
    const transcript = messages
      .filter((message) => selectedMessageIds.has(message.id))
      .map(
        (message) =>
          `[${new Date(message.timestamp).toLocaleString()}] ${message.sender}: ${message.content ?? `(${message.type})`}`,
      )
      .join('\n')
    void navigator.clipboard.writeText(transcript)
    setSelectedMessageIds(new Set())
  }

  // Abrir no topo do histórico obrigava a rolar semanas até a última mensagem — que é sempre o que
  // interessa. O hook salta ao trocar de conversa sem arrastar quem estiver lendo o histórico.
  const scroll = useScrollToLatestMessage({ conversationId: conversation.id, messageCount: messages.length })

  // O evento traz só `{ direction, sender }` — quem tem o conteúdo é a query.
  useConversationRealtime(conversation.id, () => {
    void refetch()
  })

  const blocked = isWindowBlocking(
    windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel }),
  )

  /**
   * Falha vira aviso na tela em vez de exceção silenciosa: o atendente escreveu ou gravou, achou
   * que mandou, e sem retorno não teria como saber que o cliente não recebeu nada.
   */
  /** Devolve se o envio passou: limpar o rascunho depois de uma falha apagaria o texto do operador. */
  async function runSend(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setSendFailure(undefined)
    try {
      await action()
      await refetch()
      return true
    } catch (error: unknown) {
      setSendFailure(error instanceof Error ? error.message : fallback)
      return false
    }
  }

  async function handleSend(text: string): Promise<boolean> {
    return runSend(() => api.sendMessage(conversation.id, text), labels.sendFailure)
  }

  /**
   * Reabrir a janela é ato de atendente: quem manda o template quer conversar. A tomada vai antes do
   * envio — se ficasse depois, a resposta do cliente chegaria com a conversa ainda no bot e o fluxo
   * automático responderia por cima de quem acabou de reabri-la.
   */
  async function handleSendTemplate(): Promise<void> {
    if (conversation.mode !== 'human' && onTakeover) await onTakeover()
    await runSend(() => api.sendTemplate(conversation.id, {}), labels.sendFailure)
  }

  /**
   * Texto primeiro, como mensagem própria; se falhar, nenhum anexo sai (QR-34, QR-43). Depois os
   * anexos guardados (mensagem pronta), na ordem cadastrada; por último os locais, sem legenda — o
   * texto já foi mandado. Só o que não saiu (falha, pulado, ou sem porta) continua na fila.
   */
  async function handleRichSend(): Promise<void> {
    // O upload da mídia demora e não dá retorno na tela; sem esta trava o segundo clique — ou o
    // Enter impaciente — mandava o mesmo arquivo outra vez.
    if (sendInFlightRef.current) return
    if (!draft.trim() && queue.length === 0) return
    sendInFlightRef.current = true
    setIsSendingDraft(true)
    setSendFailure(undefined)
    // Capturado antes do primeiro `await`: se o atendente trocar de conversa no meio do envio, o
    // retorno não pode aplicar estado (rascunho, fila, chave) na thread que ele está lendo agora.
    const conversationIdAtSend = conversation.id
    const isSameConversation = (): boolean => currentConversationIdRef.current === conversationIdAtSend

    // QR-32/QR-33: só a fila com item `stored` — mensagem pronta empurrada pelo picker — passa pelo
    // pipeline novo (texto -> guardados -> locais). Fila só com `local`, como antes desta feature,
    // continua indo pelo caminho antigo: uma chamada só, com o rascunho como legenda do anexo.
    const hasStoredItems = queue.some((item) => item.kind === 'stored')
    if (onSendAttachments && queue.length > 0 && !hasStoredItems) {
      const files = queue
        .filter((item): item is Extract<QueuedAttachment, { kind: 'local' }> => item.kind === 'local')
        .map((item) => item.file)
      const caption = draft
      try {
        const didSend = await runSend(() => onSendAttachments(files, caption), labels.attachFailure)
        if (!isSameConversation()) return
        if (didSend) {
          setQueue([])
          setAttachmentStatus({})
          idempotencyKeyRef.current = undefined
          setDraft('')
        }
      } finally {
        if (isSameConversation()) {
          sendInFlightRef.current = false
          setIsSendingDraft(false)
        }
      }
      return
    }

    const sendStoredAttachmentsApi = api.sendStoredAttachments
    const storedUploadIds = queue
      .filter((item): item is Extract<QueuedAttachment, { kind: 'stored' }> => item.kind === 'stored')
      .map((item) => item.uploadId)
    const idempotencyState = resolveIdempotencyKey(idempotencyKeyRef.current, storedUploadIds)
    idempotencyKeyRef.current = idempotencyState
    try {
      const result = await sendQueuedMessage({
        text: draft,
        queue,
        idempotencyKey: idempotencyState.key,
        sendText: (text) => runSend(() => api.sendMessage(conversation.id, text), labels.sendFailure),
        ...(sendStoredAttachmentsApi
          ? {
              sendStoredAttachments: (params: { uploadIds: readonly string[]; idempotencyKey: string }) =>
                sendStoredAttachmentsApi({ conversationId: conversation.id, ...params }),
            }
          : {}),
        ...(onSendAttachments
          ? { sendLocalAttachments: (files: readonly File[]) => onSendAttachments(files, '') }
          : {}),
        onAttachmentStatus: (key, status) => {
          if (isSameConversation()) setAttachmentStatus((current) => ({ ...current, [key]: status }))
        },
      })
      if (!isSameConversation()) return
      if (!result.textSent) {
        setSendFailure(labels.sendFailure)
        return
      }
      setQueue(result.remainingQueue)
      if (result.remainingQueue.length === 0) {
        idempotencyKeyRef.current = undefined
        setAttachmentStatus({})
      }
      if (draft.trim()) setDraft('')
      await refetch()
    } catch (error: unknown) {
      if (isSameConversation()) setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    } finally {
      if (isSameConversation()) {
        sendInFlightRef.current = false
        setIsSendingDraft(false)
      }
    }
  }

  async function handleAttach(file: File): Promise<void> {
    if (!onAttach) return
    await runSend(() => onAttach(file), labels.attachFailure)
  }

  function removeQueuedAttachment(item: QueuedAttachment): void {
    setQueue((current) => current.filter((queued) => attachmentKey(queued) !== attachmentKey(item)))
  }

  /**
   * "Tentar de novo" de um item é sobre aquele anexo, nunca sobre o rascunho inteiro (M3): local
   * volta por `onSendAttachments` sem legenda (o texto, se havia, já saiu); guardado vai sozinho
   * por `retryStoredAttachments`, com sua própria chave de idempotência.
   */
  function retryQueuedAttachment(item: QueuedAttachment): void {
    if (item.kind === 'local') {
      void retryLocalAttachment(item)
      return
    }
    void retryStoredAttachment(item)
  }

  async function retryLocalAttachment(item: Extract<QueuedAttachment, { kind: 'local' }>): Promise<void> {
    if (!onSendAttachments) return
    const key = attachmentKey(item)
    setAttachmentStatus((current) => ({ ...current, [key]: 'sending' }))
    try {
      await onSendAttachments([item.file], '')
      setAttachmentStatus((current) => ({ ...current, [key]: 'sent' }))
      setQueue((current) => current.filter((queued) => attachmentKey(queued) !== key))
    } catch (error: unknown) {
      setAttachmentStatus((current) => ({ ...current, [key]: 'failed' }))
      setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  async function retryStoredAttachment(item: Extract<QueuedAttachment, { kind: 'stored' }>): Promise<void> {
    const sendStoredAttachmentsApi = api.sendStoredAttachments
    if (!sendStoredAttachmentsApi) return
    const uploadIds = [item.uploadId]
    const idempotencyState = resolveIdempotencyKey(retryIdempotencyKeyRef.current, uploadIds)
    retryIdempotencyKeyRef.current = idempotencyState
    try {
      const result = await retryStoredAttachments({
        queue,
        uploadIds,
        idempotencyKey: idempotencyState.key,
        sendStoredAttachments: (params) => sendStoredAttachmentsApi({ conversationId: conversation.id, ...params }),
        onAttachmentStatus: (key, status) => setAttachmentStatus((current) => ({ ...current, [key]: status })),
      })
      setQueue(result.remainingQueue)
    } catch (error: unknown) {
      setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  function handleDownload(): void {
    downloadTextFile(
      buildTranscriptFilename(conversation.whatsappNumber, new Date()),
      buildTranscriptText({
        messages,
        whatsappNumber: conversation.whatsappNumber,
        clientName: conversation.clientName,
      }),
    )
  }

  const contextEntries = contextEntriesOf?.(conversationContext)
  const { quickReplyVariables, composerVariables } = resolveConversationVariables({
    conversationVariables: conversationVariablesFor?.(conversation, conversationContext),
    quickReplyVariables: quickReplyVariablesFor?.(conversation, conversationContext),
    composerVariables: composerVariablesFor?.(conversation, conversationContext),
  })
  /**
   * As mesmas `quickReplies` do composer simples, com as variáveis já resolvidas — o campo rico
   * recebe texto pronto. Uma segunda lista, só de formato diferente, é como as telas divergiam.
   */
  const richQuickReplies = quickReplies?.map((reply) => ({
    id: reply.key,
    label: reply.label,
    text:
      typeof reply.text === 'string'
        ? applyQuickReplyVariables(reply.text, quickReplyVariables ?? {})
        : reply.text(quickReplyVariables ?? {}),
  }))
  /**
   * Botão de raio e atalho `/` dos dois composers. `listQuickReplies` é a capacidade — sem ela na
   * porta do host, nenhum dos dois aparece, em vez de um botão que abre uma lista sempre vazia.
   */
  const savedQuickReplies = api.listQuickReplies
    ? {
        // Arrow em vez de repassar o método direto: `api.listQuickReplies` solto perde o `this` do
        // objeto que o implementa, e um cliente HTTP real costuma depender dele internamente.
        listQuickReplies: (params?: { search?: string }) => api.listQuickReplies!(params),
        conversationId: conversation.id,
        variables: quickReplyVariables,
        hasAttachmentsCapability: Boolean(api.sendStoredAttachments),
        // Empurra os anexos da mensagem escolhida como itens guardados (QR-32) — sem a porta, a
        // linha do picker já avisou e o texto entra sozinho, sem silenciosamente perder o anexo.
        onSelect: (quickReply: SavedQuickReply) => {
          const attachments = queuedAttachmentsFromQuickReply(quickReply, Boolean(api.sendStoredAttachments))
          if (attachments.length === 0) return
          setQueue((current) => [...current, ...attachments])
        },
      }
    : undefined
  const botOwnsConversation = Boolean(requireTakeoverToReply) && conversation.mode !== 'human'

  return (
    <div className="cv-workspace-pane">
      <ConversationHeader
        conversation={conversation}
        busy={busy}
        {...(onTakeover ? { onTakeover } : {})}
        {...(onReturnToBot ? { onReturnToBot } : {})}
        {...(onFinish ? { onFinish } : {})}
        onDownload={onDownload ?? handleDownload}
        onBack={onBack}
        onOpenDocuments={() => setDocumentsOpen(!documentsOpen)}
        documentsOpen={documentsOpen}
        {...(extraUtilities ? { extraUtilities } : {})}
      />

      {(contextEntries && contextEntries.length > 0) || flowLabel ? (
        <ConversationContextPanel entries={contextEntries ?? []} {...(flowLabel ? { flowLabel } : {})} />
      ) : null}
      <ConversationDocumentsPanel conversationId={conversation.id} open={documentsOpen} />

      {renderAboveTranscript?.(conversation, conversationContext)}

      {/* Mesmo wallpaper do preview do cliente: atendente e cliente devem ver a conversa com a
          mesma aparência, senão o preview deixa de ser referência confiável. */}
      <ConversationWallpaper
        ref={scroll.containerRef}
        onScroll={scroll.handleScroll}
        className="cv-workspace-transcript"
      >
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined
          const startsNewDay =
            !previous || new Date(message.timestamp).toDateString() !== new Date(previous.timestamp).toDateString()

          return (
            <div key={message.id}>
              {startsNewDay ? <DateDivider iso={message.timestamp} /> : null}
              <MessageBubble
                message={message}
                isMine={message.direction === 'outbound'}
                isFirstInGroup={!previous || previous.sender !== message.sender}
                {...(messageSelection
                  ? {
                      isSelecting: selectedMessageIds.size > 0,
                      isSelected: selectedMessageIds.has(message.id),
                      onToggleSelect: () => toggleMessageSelected(message.id),
                    }
                  : {})}
              />
            </div>
          )
        })}
      </ConversationWallpaper>

      {messageSelection && selectedMessageIds.size > 0 ? (
        <div className="cv-workspace-selection">
          <span>{labels.messagesSelected(selectedMessageIds.size)}</span>
          <div className="cv-workspace-selection__actions">
            <button
              data-cv-tooltip={labels.bulkClear}
              aria-label={labels.bulkClear}
              type="button"
              onClick={() => setSelectedMessageIds(new Set())}
            >
              {labels.bulkClear}
            </button>
            <button
              data-cv-tooltip={labels.copySelected}
              aria-label={labels.copySelected}
              type="button"
              onClick={copySelectedMessages}
            >
              {labels.copySelected}
            </button>
          </div>
        </div>
      ) : null}

      {sendFailure ? (
        <p role="alert" className="cv-workspace-alert">
          {sendFailure}
        </p>
      ) : null}

      {blocked ? (
        <WindowExpiredNotice disabled={busy} onSendTemplate={() => void handleSendTemplate()} />
      ) : botOwnsConversation ? (
        // Responder com a conversa no bot atropelaria o fluxo automático no meio de uma pergunta.
        <p className="cv-workspace-notice">{labels.takeoverToReply}</p>
      ) : composer === 'rich' ? (
        <RichMessageComposer
          value={draft}
          onChange={setDraft}
          onSend={() => void handleRichSend()}
          {...(onSendAttachments
            ? {
                onAttachFiles: (files: FileList) =>
                  setQueue((current) => [
                    ...current,
                    ...Array.from(files).map((file): QueuedAttachment => ({ kind: 'local', file })),
                  ]),
              }
            : onAttach
              ? {
                  onAttachFiles: (files: FileList) => {
                    for (const file of Array.from(files)) void handleAttach(file)
                  },
                }
              : {})}
          placeholder={labels.composerPlaceholder}
          isSending={busy || isSendingDraft}
          hasQueuedAttachments={queue.length > 0}
          {...(onRecordAudio
            ? {
                idleAction: (
                  <AudioRecorderButton
                    onRecorded={(file) => void runSend(() => onRecordAudio(file), labels.recordFailure)}
                    onFailure={(failureMessage) => setSendFailure(failureMessage)}
                  />
                ),
              }
            : {})}
          {...(queue.length > 0
            ? {
                attachmentsPreview: (
                  <QueuedAttachmentsList
                    items={queue}
                    statusOf={(key) => attachmentStatus[key] ?? 'waiting'}
                    onRemove={removeQueuedAttachment}
                    onRetry={retryQueuedAttachment}
                    getThumbnailUrl={getQueuedAttachmentThumbnailUrl}
                    busy={isSendingDraft}
                    labels={{
                      remove: labels.attachmentRemove,
                      waiting: labels.attachmentWaiting,
                      sending: labels.attachmentSending,
                      sent: labels.attachmentSent,
                      failed: labels.attachmentFailed,
                      retry: labels.attachmentRetry,
                    }}
                  />
                ),
              }
            : {})}
          {...(richQuickReplies ? { quickReplies: [...richQuickReplies] } : {})}
          {...(composerVariables ? { variables: [...composerVariables] } : {})}
          {...(savedQuickReplies ? { savedQuickReplies } : {})}
        />
      ) : (
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={(text) => void handleSend(text)}
          // Habilita clipe E microfone: o composer desenha o gravador sozinho quando existe um jeito
          // de entregar arquivo, porque áudio gravado é um anexo como qualquer outro.
          {...(onAttach ? { onAttach: (file: File) => void handleAttach(file) } : {})}
          placeholder={labels.composerPlaceholder}
          {...(quickReplies ? { quickReplies } : {})}
          {...(quickReplyVariables ? { quickReplyVariables } : {})}
          {...(savedQuickReplies ? { savedQuickReplies } : {})}
        />
      )}
    </div>
  )
}
