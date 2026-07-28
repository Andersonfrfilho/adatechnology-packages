import { and, asc, count, desc, eq, ilike, inArray, lt, or, type SQL } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import { documents, sessions, type DocumentRow, type NewDocumentRow } from '../schema/schema'

export interface LinkDocumentParams {
  companyId: string
  sessionId: string
  messageId?: string | null
  uploadId: string
  filename: string
  mimeType: string
  sizeBytes: number
  sha256?: string | null
  source: string
}

export interface ListDocumentsParams {
  companyId: string
  sessionId: string
  search?: string
  /**
   * Origens aceitas, como lista explícita (`['agent', 'bot']`) e não como apelido de UI.
   *
   * Agrupamento tipo "Equipe" é vocabulário de tela e muda por produto; traduzir aqui obrigaria o
   * módulo a conhecer o rótulo de cada host. Quem recebe o apelido na borda é a rota.
   */
  sources?: readonly string[]
  sortDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ListCompanyDocumentsParams {
  companyId: string
  search?: string
  sources?: readonly string[]
  sortDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface CompanyDocumentRow {
  id: string
  uploadId: string
  filename: string
  mimeType: string
  sizeBytes: number
  source: string
  linkedAt: Date
  whatsappNumber: string
}

export interface ListCompanyDocumentsResult {
  rows: CompanyDocumentRow[]
  total: number
}

export interface ListDocumentsResult {
  rows: DocumentRow[]
  /** Total no servidor, ANTES do corte de página — é o que permite calcular a última página. */
  total: number
}

const DEFAULT_LIMIT = 50

/**
 * O filtro de busca da biblioteca da empresa: nome do arquivo OU telefone da conversa.
 *
 * O telefone é comparado só pelos dígitos porque a tela mostra "+55 (11) 94444-3333" e o banco
 * guarda "5511944443333" — quem copia o número da tela e cola na busca casaria zero linhas se o
 * termo fosse usado cru. Por isso a mesma palavra vira dois predicados: o nome mantém a pontuação
 * (faz parte do arquivo), o número perde.
 *
 * Termo sem dígito nenhum não gera o predicado do telefone — `%%` casaria toda conversa e a busca
 * por nome deixaria de filtrar.
 */
export function companyDocumentSearch(search: string | undefined): SQL | undefined {
  const term = search?.trim()
  if (!term) return undefined

  const digits = term.replace(/\D/g, '')
  const byFilename = ilike(documents.filename, `%${term}%`)
  if (!digits) return byFilename

  return or(byFilename, ilike(sessions.whatsappNumber, `%${digits}%`))
}

export class DocumentRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  /**
   * Idempotente por (companyId, uploadId), garantido pelo índice único e não por SELECT prévio: o
   * job de ingestão é reentregue por retry e duas tentativas concorrentes passariam as duas por uma
   * checagem, duplicando a linha no painel.
   *
   * Devolve `undefined` quando o documento já estava linkado.
   */
  async link(params: LinkDocumentParams): Promise<DocumentRow | undefined> {
    const values: NewDocumentRow = {
      companyId: params.companyId,
      sessionId: params.sessionId,
      messageId: params.messageId ?? null,
      uploadId: params.uploadId,
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      sha256: params.sha256 ?? null,
      source: params.source,
    }

    const [created] = await this.db.insert(documents).values(values).onConflictDoNothing().returning()
    return created
  }

  async listByConversation(params: ListDocumentsParams): Promise<ListDocumentsResult> {
    const filters = [eq(documents.companyId, params.companyId), eq(documents.sessionId, params.sessionId)]
    // `ilike` com % nas duas pontas: o painel busca por parte do nome, e o atendente não sabe como
    // o arquivo chegou nomeado.
    if (params.search) filters.push(ilike(documents.filename, `%${params.search}%`))
    // Lista vazia é tratada como ausência de filtro, não como "nenhuma origem aceita": um
    // `inArray` com `[]` gera `false` e devolveria zero linhas para quem só quis dizer "todas".
    if (params.sources && params.sources.length > 0) {
      filters.push(inArray(documents.source, [...params.sources]))
    }

    const where = and(...filters)
    const limit = params.limit ?? DEFAULT_LIMIT
    const page = params.page && params.page > 0 ? params.page : 1
    const orderBy = params.sortDirection === 'asc' ? asc(documents.linkedAt) : desc(documents.linkedAt)

    // Duas consultas com o MESMO `where`: a contagem tem de ignorar o corte de página, senão o
    // total viraria o tamanho da página e a paginação nunca sairia da primeira.
    const [rows, counted] = await Promise.all([
      this.db
        .select()
        .from(documents)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(documents).where(where),
    ])

    return { rows, total: counted[0]?.value ?? 0 }
  }

  /**
   * A biblioteca da EMPRESA inteira, não de uma conversa.
   *
   * A busca casa nome do arquivo OU telefone da conversa — ver `companyDocumentSearch`.
   *
   * Faz join com `sessions` para carregar de qual conversa cada arquivo veio — numa lista global,
   * arquivo sem essa referência é inútil: o atendente vê "comprovante.pdf" e não sabe de quem.
   *
   * Ordena por `linkedAt` apoiada no índice `idx_documents_company_linked`, que já existia para a
   * varredura de retenção.
   */
  async listByCompany(params: ListCompanyDocumentsParams): Promise<ListCompanyDocumentsResult> {
    const filters = [eq(documents.companyId, params.companyId)]
    const search = companyDocumentSearch(params.search)
    if (search) filters.push(search)
    if (params.sources && params.sources.length > 0) {
      filters.push(inArray(documents.source, [...params.sources]))
    }

    const where = and(...filters)
    const limit = params.limit ?? DEFAULT_LIMIT
    const page = params.page && params.page > 0 ? params.page : 1
    const orderBy = params.sortDirection === 'asc' ? asc(documents.linkedAt) : desc(documents.linkedAt)

    const [rows, counted] = await Promise.all([
      this.db
        .select({
          id: documents.id,
          uploadId: documents.uploadId,
          filename: documents.filename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          source: documents.source,
          linkedAt: documents.linkedAt,
          // Só o número: o NOME do cliente é dado do produto (tabela própria dele), não do
          // módulo. Quem quiser exibir "Marina Alves" enriquece na borda.
          whatsappNumber: sessions.whatsappNumber,
        })
        .from(documents)
        .innerJoin(sessions, eq(documents.sessionId, sessions.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      // O mesmo join da listagem, e não só `from(documents)`: a busca pode citar
      // `sessions.whatsapp_number`, e uma contagem sem a tabela na cláusula não compila — pior,
      // se compilasse, o total divergiria das linhas e a paginação prometeria páginas vazias.
      this.db
        .select({ value: count() })
        .from(documents)
        .innerJoin(sessions, eq(documents.sessionId, sessions.id))
        .where(where),
    ])

    return { rows, total: counted[0]?.value ?? 0 }
  }

  /**
   * Um documento pela key do objeto. Serve para recuperar o nome original na hora de assinar o
   * download: a key é caminho no bucket e salvaria o arquivo com o id da Meta.
   */
  async findByUploadId(companyId: string, uploadId: string): Promise<DocumentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.companyId, companyId), eq(documents.uploadId, uploadId)))
      .limit(1)

    return row
  }

  /**
   * Os objetos a apagar no storage antes de a linha sumir.
   *
   * Existe porque a cascata da FK apaga a linha e deixa o binário órfão: quem for apagar a conversa
   * precisa desta lista primeiro, senão paga armazenamento para sempre por arquivo inalcançável.
   */
  async listUploadIdsBySession(companyId: string, sessionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ uploadId: documents.uploadId })
      .from(documents)
      .where(and(eq(documents.companyId, companyId), eq(documents.sessionId, sessionId)))

    return rows.map((row) => row.uploadId)
  }

  /** Varredura de retenção por idade — o par é o mesmo cuidado com o objeto no storage. */
  async listExpired(companyId: string, olderThan: Date, limit = DEFAULT_LIMIT): Promise<DocumentRow[]> {
    return this.db
      .select()
      .from(documents)
      .where(and(eq(documents.companyId, companyId), lt(documents.linkedAt, olderThan)))
      .orderBy(documents.linkedAt)
      .limit(limit)
  }

  async deleteById(companyId: string, id: string): Promise<void> {
    await this.db.delete(documents).where(and(eq(documents.companyId, companyId), eq(documents.id, id)))
  }
}
