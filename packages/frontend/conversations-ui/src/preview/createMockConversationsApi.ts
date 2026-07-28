/**
 * `ConversationsApi` servido pelo store em memória. Como o pacote é headless e recebe a API por
 * injeção, o preview de atendimento humano não precisa de servidor, banco nem Meta: é só outra
 * implementação deste mesmo contrato.
 *
 * Toda resposta é assíncrona e passa por um atraso configurável — API instantânea esconde estados
 * de carregamento, e é neles que a inbox costuma mostrar defeito.
 */

import type { MessagePayload } from '../types'
import type {
  CompanyDocumentPage,
  ConversationDocumentPage,
  ConversationPage,
  ConversationTemplate,
  ConversationsApi,
  ListConversationsParams,
} from '../providers/types'
import { PREVIEW_DOCUMENTS } from './previewFixtures'
import { previewFileBase64, previewFileUrl } from './previewMediaSource'
import type { PreviewStore } from './previewStore'

export type CreateMockConversationsApiParams = {
  readonly store: PreviewStore
  readonly latencyMs?: number
  readonly agentName?: string
}

const DEFAULT_LATENCY_MS = 120

const PREVIEW_AGENT_ID = 'preview-agent'

const PREVIEW_TEMPLATES: readonly ConversationTemplate[] = [
  { name: 'retomada_atendimento', language: 'pt_BR', status: 'APPROVED', category: 'UTILITY' },
  { name: 'lembrete_documentos', language: 'pt_BR', status: 'APPROVED', category: 'UTILITY' },
  { name: 'promocao_taxa', language: 'pt_BR', status: 'PENDING', category: 'MARKETING' },
]

/**
 * O mock satisfaz `ConversationsApi`, mas com o retorno de `fetchConversations` ESTREITADO para a
 * forma paginada. Sem isto o contrato — que aceita array ou página — obrigaria todo consumidor do
 * preview a desempacotar uma união que aqui nunca varia.
 */
export type MockConversationsApi = Omit<ConversationsApi, 'fetchConversations'> & {
  fetchConversations(params?: ListConversationsParams): Promise<ConversationPage>
}

export function createMockConversationsApi(params: CreateMockConversationsApiParams): MockConversationsApi {
  const latencyMs = params.latencyMs ?? DEFAULT_LATENCY_MS

  async function withLatency<TResult>(produce: () => TResult): Promise<TResult> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs))
    return produce()
  }

  return {
    // Devolve a forma paginada, não o array puro: é a que o contrato passou a oferecer e a que
    // permite o preview desenhar controles de página. O total é contado ANTES do corte — depois
    // dele seria sempre o tamanho da página, e a paginação nunca sairia da primeira.
    fetchConversations(fetchParams): Promise<ConversationPage> {
      return withLatency(() => {
        const conversations = params.store.listConversations({
          waitingHuman: fetchParams?.waitingHuman,
          search: fetchParams?.search,
        })

        const limit = fetchParams?.limit ?? conversations.length
        const page = fetchParams?.page ?? 1
        return {
          conversations: conversations.slice((page - 1) * limit, page * limit),
          total: conversations.length,
        }
      })
    },

    fetchMessages(conversationId, fetchParams): Promise<MessagePayload[]> {
      return withLatency(() => {
        const messages = params.store.listMessages(conversationId)
        const limit = fetchParams?.limit
        return limit ? messages.slice(-limit) : messages
      })
    },

    sendMessage(conversationId, text): Promise<MessagePayload> {
      return withLatency(() =>
        params.store.appendMessage({ conversationId, content: text, direction: 'outbound', sender: 'agent' }),
      )
    },

    sendMedia(conversationId, data): Promise<MessagePayload> {
      return withLatency(() =>
        params.store.appendMessage({
          conversationId,
          content: data.caption ?? data.filename,
          direction: 'outbound',
          sender: 'agent',
        }),
      )
    },

    sendTemplate(conversationId, data): Promise<void> {
      return withLatency(() => {
        params.store.appendMessage({
          conversationId,
          // Sem nome, o host está pedindo o template padrão do backend — o mock representa isso
          // pelo que o atendente veria, não por um nome inventado.
          content: `[template] ${data.templateName ?? PREVIEW_TEMPLATES[0]?.name ?? 'padrao'}`,
          direction: 'outbound',
          sender: 'agent',
        })
      })
    },

    markRead(conversationId): Promise<void> {
      return withLatency(() => params.store.markRead(conversationId))
    },

    getContext(conversationId): Promise<Record<string, unknown>> {
      return withLatency(() => {
        const conversation = params.store.listConversations().find((item) => item.id === conversationId)
        return {
          currentState: conversation?.currentState ?? 'unknown',
          mode: conversation?.mode ?? 'bot',
          preview: true,
        }
      })
    },

    /**
     * Espelha o backend em busca, filtro de origem, ordenação E paginação. Mock que ignora params
     * faz o painel parecer quebrado aqui e, pior, esconde o caso em que o backend também os ignora
     * — foi exatamente assim que o filtro de origem passou a existir só no contrato.
     */
    getDocuments(conversationId, documentParams): Promise<ConversationDocumentPage> {
      return withLatency(() => {
        let documents = [...(PREVIEW_DOCUMENTS[conversationId] ?? [])]

        const search = documentParams?.search?.trim().toLowerCase()
        if (search) {
          documents = documents.filter((document) => document.filename.toLowerCase().includes(search))
        }

        // 'team' agrupa agent + bot, como o painel apresenta.
        const source = documentParams?.source
        if (source === 'team') {
          documents = documents.filter((document) => document.source === 'agent' || document.source === 'bot')
        } else if (source) {
          documents = documents.filter((document) => document.source === source)
        }

        documents.sort((left, right) =>
          documentParams?.sortDirection === 'asc'
            ? left.linkedAt.localeCompare(right.linkedAt)
            : right.linkedAt.localeCompare(left.linkedAt),
        )

        // Total contado ANTES do corte — depois seria sempre o tamanho da página, e a paginação
        // nunca sairia da primeira.
        const total = documents.length
        const limit = documentParams?.limit ?? total
        const page = documentParams?.page ?? 1

        return { documents: documents.slice((page - 1) * limit, page * limit), total }
      })
    },

    /**
     * Zip de mentira: um texto listando o que entraria. Basta para exercitar seleção, botão e o
     * caminho de download no preview, sem arrastar uma lib de compactação para o pacote.
     */
    downloadDocumentsArchive(conversationId, uploadIds): Promise<Blob> {
      return withLatency(() => {
        const known = PREVIEW_DOCUMENTS[conversationId] ?? []
        const names = uploadIds.map((id) => known.find((document) => document.id === id)?.filename ?? id)
        return new Blob([`preview: ${names.length} arquivo(s)\n${names.join('\n')}`], { type: 'application/zip' })
      })
    },

    /** Junta as bibliotecas de todas as conversas do fixture, com a origem de cada arquivo. */
    getAllDocuments(documentParams): Promise<CompanyDocumentPage> {
      return withLatency(() => {
        let all = Object.entries(PREVIEW_DOCUMENTS).flatMap(([conversationId, docs]) =>
          docs.map((document) => ({ ...document, conversationId })),
        )

        // Mesma regra do backend (`companyDocumentSearch`): o termo casa nome do arquivo OU
        // telefone da conversa, e o telefone só pelos dígitos — o preview mostra o número
        // formatado, então é assim que o atendente vai colá-lo na busca.
        const search = documentParams?.search?.trim().toLowerCase()
        if (search) {
          const digits = search.replace(/\D/g, '')
          all = all.filter(
            (document) =>
              document.filename.toLowerCase().includes(search) ||
              (digits !== '' && document.conversationId.includes(digits)),
          )
        }

        const source = documentParams?.source
        if (source === 'team') {
          all = all.filter((document) => document.source === 'agent' || document.source === 'bot')
        } else if (source) {
          all = all.filter((document) => document.source === source)
        }

        all.sort((left, right) =>
          documentParams?.sortDirection === 'asc'
            ? left.linkedAt.localeCompare(right.linkedAt)
            : right.linkedAt.localeCompare(left.linkedAt),
        )

        const total = all.length
        const limit = documentParams?.limit ?? total
        const page = documentParams?.page ?? 1
        return { documents: all.slice((page - 1) * limit, page * limit), total }
      })
    },

    // Devolve os bytes DO TIPO do documento, não uma imagem para tudo: antes, abrir um PDF entregava
    // um PNG rotulado `application/pdf` e o leitor recusava o arquivo. O `uploadId` é a única pista
    // que o contrato dá, então o tipo vem da própria biblioteca.
    getDocumentUrl(uploadId): Promise<string> {
      return withLatency(() => {
        const found = Object.values(PREVIEW_DOCUMENTS)
          .flat()
          .find((document) => document.id === uploadId)
        return previewFileUrl(found?.mimeType, found?.filename)
      })
    },

    // Caminho da mídia ainda não ingerida: o backend busca na Meta e devolve base64. Resolve pelo
    // id para a bolha receber os bytes DO TIPO dela — devolvendo um PNG para todo id, vídeo e áudio
    // apareciam quebrados na thread mesmo havendo amostra válida do formato.
    getMediaProxyUrl(mediaId): Promise<{ mimeType: string; data: string }> {
      return withLatency(() => {
        const found = Object.values(PREVIEW_DOCUMENTS)
          .flat()
          .find((document) => document.id === `preview/inbound/${mediaId}`)
        return previewFileBase64(found?.mimeType, found?.filename)
      })
    },

    takeover(conversationId): Promise<void> {
      return withLatency(() =>
        params.store.setMode({ conversationId, mode: 'human', assignedUserId: PREVIEW_AGENT_ID }),
      )
    },

    release(conversationId): Promise<void> {
      return withLatency(() => params.store.setMode({ conversationId, mode: 'bot' }))
    },

    // Encerrar devolve ao bot como o release, e é de propósito: a diferença entre os dois é a
    // despedida, que o host manda antes de chamar aqui. O mock não a inventa.
    finalize(conversationId): Promise<void> {
      return withLatency(() => params.store.setMode({ conversationId, mode: 'bot' }))
    },

    markAllRead(): Promise<void> {
      return withLatency(() => {
        for (const conversation of params.store.listConversations()) {
          params.store.markRead(conversation.id)
        }
      })
    },

    listTemplates(): Promise<ConversationTemplate[]> {
      return withLatency(() => [...PREVIEW_TEMPLATES])
    },
  }
}
