import type { DocumentRepository } from '../repositories/DocumentRepository'

export type ListCompanyDocumentsParams = {
  companyId: string
  search?: string
  /** Origens explícitas. O apelido de UI ("Equipe") é traduzido na borda HTTP, não aqui. */
  sources?: readonly string[]
  sortDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Um arquivo na biblioteca da empresa. Igual ao da conversa, mais `conversationId` — sem saber de
 * quem veio, uma lista global de anexos não responde nenhuma pergunta útil.
 */
export type CompanyDocumentView = {
  /** O `uploadId` (key no storage), pelo mesmo motivo do `ConversationDocumentView`. */
  id: string
  conversationId: string
  filename: string
  mimeType: string
  sizeBytes: number
  source: string
  linkedAt: string
}

export type CompanyDocumentsPage = {
  documents: CompanyDocumentView[]
  total: number
}

/**
 * Biblioteca de arquivos de todas as conversas da empresa.
 *
 * Existe separada de `ListConversationDocumentsUseCase` porque a pergunta é outra: aquela parte de
 * uma conversa conhecida, esta varre a empresa e por isso precisa dizer de qual conversa cada
 * arquivo veio. Reaproveitar a primeira exigiria um `sessionId` opcional que muda o significado do
 * retorno — dois nomes claros custam menos que um parâmetro que dobra o comportamento.
 */
export class ListCompanyDocumentsUseCase {
  constructor(private readonly documentRepository: DocumentRepository) {}

  async execute(params: ListCompanyDocumentsParams): Promise<CompanyDocumentsPage> {
    const { rows, total } = await this.documentRepository.listByCompany({
      companyId: params.companyId,
      ...(params.search ? { search: params.search } : {}),
      ...(params.sources && params.sources.length > 0 ? { sources: params.sources } : {}),
      ...(params.sortDirection ? { sortDirection: params.sortDirection } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    })

    return {
      documents: rows.map((row) => ({
        id: row.uploadId,
        conversationId: row.whatsappNumber,
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
