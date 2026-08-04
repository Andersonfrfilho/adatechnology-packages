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
  readonly quickReplyVariables?: Record<string, string>
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
  quickReplyVariables,
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
  const [attachFailure, setAttachFailure] = useState<string | undefined>(undefined)

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

  async function handleSend(text: string): Promise<void> {
    await api.sendMessage(conversation.id, text)
    await refetch()
  }

  /**
   * Falha vira aviso na tela em vez de exceção silenciosa: o atendente gravou, achou que mandou, e
   * sem retorno não teria como saber que o cliente não recebeu nada.
   */
  async function handleAttach(file: File): Promise<void> {
    if (!onAttach) return
    setAttachFailure(undefined)
    try {
      await onAttach(file)
      await refetch()
    } catch (error: unknown) {
      setAttachFailure(error instanceof Error ? error.message : labels.attachFailure)
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

  return (
    <div className="cv-workspace-pane">
      <ConversationHeader
        conversation={conversation}
        busy={busy}
        {...(onTakeover ? { onTakeover } : {})}
        {...(onReturnToBot ? { onReturnToBot } : {})}
        {...(onFinish ? { onFinish } : {})}
        onDownload={handleDownload}
        onBack={onBack}
        onOpenDocuments={() => setDocumentsOpen(!documentsOpen)}
        documentsOpen={documentsOpen}
        {...(extraUtilities ? { extraUtilities } : {})}
      />

      {contextEntries && contextEntries.length > 0 ? <ConversationContextPanel entries={contextEntries} /> : null}
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

      {attachFailure ? (
        <p role="alert" className="cv-workspace-alert">
          {attachFailure}
        </p>
      ) : null}

      {blocked ? (
        <WindowExpiredNotice
          disabled={busy}
          onSendTemplate={() => void api.sendTemplate(conversation.id, {}).then(() => refetch())}
        />
      ) : (
        <MessageComposer
          onSend={(text) => void handleSend(text)}
          // Habilita clipe E microfone: o composer desenha o gravador sozinho quando existe um jeito
          // de entregar arquivo, porque áudio gravado é um anexo como qualquer outro.
          {...(onAttach ? { onAttach: (file: File) => void handleAttach(file) } : {})}
          placeholder={labels.composerPlaceholder}
          {...(quickReplies ? { quickReplies } : {})}
          {...(quickReplyVariables ? { quickReplyVariables } : {})}
        />
      )}
    </div>
  )
}
