/**
 * Bancada de teste manual de mídia — montável em uma linha por qualquer projeto que adote o SDK.
 *
 * Existe porque o defeito que ela pega não é pegável por teste automatizado: "o PDF abre?" depende
 * do leitor do navegador, "o vídeo toca?" do decodificador, e "a aba abre?" da política do Chrome
 * sobre `data:` URL. Teste unitário confere bytes; só o olho confere que o arquivo abre. Sem uma
 * superfície pronta no pacote, cada projeto teria de montar a sua — e, na prática, nenhum montava.
 *
 * Traz o próprio store, o próprio mock e o próprio provider: o host não injeta nada. E não passa
 * `onResolveMediaUrl` em lugar nenhum de propósito — é o `MessageBubble` resolvendo mídia pelo
 * `ConversationsApi` do contexto, então se essa resolução automática quebrar, esta tela mostra.
 */

import { useMemo } from 'react'
import { ConversationsProvider } from '../providers/ConversationsProvider'
import { DocumentsLibrary } from '../DocumentsLibrary'
import { ConversationDocumentsPanel } from '../ConversationDocumentsPanel'
import { MessageBubble } from '../MessageBubble'
import { ConversationWallpaper } from '../Wallpaper'
import { createMockConversationsApi } from './createMockConversationsApi'
import { createMockSSEProvider } from './createMockSSEProvider'
import { createPreviewStore } from './previewStore'
import { PREVIEW_CONVERSATIONS, PREVIEW_DOCUMENTS, PREVIEW_MESSAGES } from './previewFixtures'

/** A conversa do fixture que carrega uma mensagem de cada tipo aceito. */
export const MEDIA_TYPES_CONVERSATION_ID = '5511944443333'

export type MediaTypesPreviewProps = {
  /** Outra conversa do fixture, se o projeto tiver acrescentado a sua. */
  conversationId?: string
  className?: string
}

export function MediaTypesPreview({
  conversationId = MEDIA_TYPES_CONVERSATION_ID,
  className,
}: MediaTypesPreviewProps) {
  const store = useMemo(
    () => createPreviewStore({ conversations: PREVIEW_CONVERSATIONS, messages: PREVIEW_MESSAGES }),
    [],
  )
  const api = useMemo(() => createMockConversationsApi({ store }), [store])
  const sse = useMemo(() => createMockSSEProvider({ store }), [store])

  const messages = PREVIEW_MESSAGES[conversationId] ?? []
  const documents = PREVIEW_DOCUMENTS[conversationId] ?? []
  const mimeTypes = [...new Set(documents.map((document) => document.mimeType))]

  return (
    <ConversationsProvider api={api} sse={sse}>
      <div className={className}>
        <header className="border-b px-4 py-3 dark:border-gray-700">
          <h1 className="text-lg font-semibold">Teste manual de mídia</h1>
          <p className="text-sm text-gray-500">
            {documents.length} arquivos, {mimeTypes.length} tipos. Clique no olho para abrir em aba nova e no
            botão da bolha para carregar a mídia na thread — é o que teste automatizado não vê.
          </p>
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Biblioteca da empresa</h2>
            {/* Sem paginar: a bancada serve para ver TODOS os tipos de uma vez. */}
            <DocumentsLibrary perPage={documents.length || 20} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Painel da conversa</h2>
            <ConversationDocumentsPanel conversationId={conversationId} open perPage={documents.length || 20} />

            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bolhas na thread</h2>
            <ConversationWallpaper className="max-h-[70vh] overflow-y-auto rounded-lg px-3 py-2">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.direction === 'outbound'}
                  isFirstInGroup={index === 0 || messages[index - 1]?.sender !== message.sender}
                />
              ))}
            </ConversationWallpaper>
          </section>
        </div>
      </div>
    </ConversationsProvider>
  )
}
