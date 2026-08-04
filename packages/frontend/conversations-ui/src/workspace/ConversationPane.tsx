/**
 * Coluna do meio: cabeçalho, contexto, documentos, transcript e composer da conversa aberta.
 *
 * Era a peça mais copiada entre os produtos, e a que mais divergia: um perdia o salto para a
 * última mensagem, outro engolia falha de anexo, outro não abria a biblioteca de arquivos.
 */

import { useState, type ReactNode } from 'react'

import { ConversationContextPanel, type ConversationContextEntry } from '../ConversationContextPanel'
import { ConversationDocumentsPanel } from '../ConversationDocumentsPanel'
import { ConversationHeader, type ConversationHeaderUtility } from '../ConversationHeader'
import { ConversationWallpaper } from '../Wallpaper'
import { DateDivider } from '../DateDivider'
import { MessageBubble } from '../MessageBubble'
import { MessageComposer, type QuickReply } from '../MessageComposer'
import { WindowExpiredNotice, isWindowBlocking } from '../WindowExpiredNotice'
import { windowOf } from '../conversationWindow'
import {
  buildTranscriptFilename,
  buildTranscriptText,
  downloadTextFile,
} from '../conversationTranscript'
import { useConversationContext } from '../hooks/useConversationContext'
import { useConversationMessages } from '../hooks/useConversationMessages'
import { useConversationRealtime } from '../hooks/useConversationRealtime'
import { useScrollToLatestMessage } from '../hooks/useScrollToLatestMessage'
import { useConversations } from '../providers/ConversationsProvider'
import type { ConversationSummary } from '../providers/types'
import type { ConversationsWorkspaceLabels } from './labels'

export interface ConversationPaneProps {
  readonly conversation: ConversationSummary
  readonly now: number
  readonly busy: boolean
  readonly labels: ConversationsWorkspaceLabels
  readonly onTakeover?: (() => void) | undefined
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
  /** Peça do produto entre o contexto e o transcript (ex.: ficha do lead, resumo do pedido). */
  readonly renderAboveTranscript?: (conversation: ConversationSummary) => ReactNode
  readonly onAttach?: ((file: File) => Promise<void>) | undefined
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
  renderAboveTranscript,
  onAttach,
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
  async function runSend(action: () => Promise<unknown>, fallback: string): Promise<void> {
    setSendFailure(undefined)
    try {
      await action()
      await refetch()
    } catch (error: unknown) {
      setSendFailure(error instanceof Error ? error.message : fallback)
    }
  }

  async function handleSend(text: string): Promise<void> {
    await runSend(() => api.sendMessage(conversation.id, text), labels.sendFailure)
  }

  async function handleAttach(file: File): Promise<void> {
    if (!onAttach) return
    await runSend(() => onAttach(file), labels.attachFailure)
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

      {renderAboveTranscript?.(conversation)}

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
              />
            </div>
          )
        })}
      </ConversationWallpaper>

      {sendFailure ? (
        <p role="alert" className="cv-workspace-alert">
          {sendFailure}
        </p>
      ) : null}

      {blocked ? (
        <WindowExpiredNotice
          disabled={busy}
          onSendTemplate={() => void api.sendTemplate(conversation.id, {}).then(() => refetch())}
        />
      ) : botOwnsConversation ? (
        // Responder com a conversa no bot atropelaria o fluxo automático no meio de uma pergunta.
        <p className="cv-workspace-notice">{labels.takeoverToReply}</p>
      ) : (
        <MessageComposer
          onSend={(text) => void handleSend(text)}
          // Habilita clipe E microfone: o composer desenha o gravador sozinho quando existe um jeito
          // de entregar arquivo, porque áudio gravado é um anexo como qualquer outro.
          {...(onAttach ? { onAttach: (file: File) => void handleAttach(file) } : {})}
          placeholder={labels.composerPlaceholder}
          {...(quickReplies ? { quickReplies } : {})}
          {...(quickReplyVariablesFor ? { quickReplyVariables: quickReplyVariablesFor(conversation, conversationContext) } : {})}
        />
      )}
    </div>
  )
}
