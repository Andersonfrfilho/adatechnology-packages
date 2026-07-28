import { SessionNotFoundError } from '@adatechnology/meta-whatsapp-contracts'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { SessionRepository } from '../repositories/SessionRepository'

export type ListConversationDocumentsParams = {
  companyId: string
  whatsappNumber: string
  search?: string
  /** Origens explícitas. O apelido de UI ("Equipe") é traduzido na borda HTTP, não aqui. */
  sources?: readonly string[]
  sortDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * O que o `ConversationDocumentsPanel` do conversations-ui consome. O shape é o do pacote de UI
 * (`ConversationDocument`), com `linkedAt` já em ISO para não obrigar cada host a serializar.
 */
export type ConversationDocumentView = {
  /**
   * O `uploadId` (key no storage), e NÃO o id da linha.
   *
   * É este valor que o consumidor devolve para pedir a URL assinada ou montar o zip, então expor o
   * UUID da tabela aqui fazia o download apontar para um objeto inexistente — falha que só aparece
   * no clique, porque a assinatura é gerada sem consultar o bucket.
   */
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  source: string
  linkedAt: string
}

/** Espelha o `ConversationDocumentPage` do conversations-ui: lista da página + total no servidor. */
export type ConversationDocumentsPage = {
  documents: ConversationDocumentView[]
  total: number
}

export class ListConversationDocumentsUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly documentRepository: DocumentRepository,
  ) {}

  async execute(params: ListConversationDocumentsParams): Promise<ConversationDocumentsPage> {
    const session = await this.sessionRepository.getContext(params.companyId, params.whatsappNumber)
    if (!session) throw new SessionNotFoundError(params.whatsappNumber)

    const { rows, total } = await this.documentRepository.listByConversation({
      companyId: params.companyId,
      sessionId: session.id,
      ...(params.search ? { search: params.search } : {}),
      ...(params.sources && params.sources.length > 0 ? { sources: params.sources } : {}),
      ...(params.sortDirection ? { sortDirection: params.sortDirection } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    })

    return {
      documents: rows.map((row) => ({
        id: row.uploadId,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        source: row.source,
        linkedAt: row.linkedAt.toISOString(),
      })),
      total,
    }
  }
}
