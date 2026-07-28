import { and, desc, eq, sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type {
  ConversationSummary,
  MessageDirection,
  SessionMode,
  SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import { messages, sessions, type SessionRow } from '../schema/schema'

export interface ListConversationsFilters {
  page?: number
  limit?: number
  waitingHuman?: boolean
  search?: string
}

const DEFAULT_LIMIT = 20

// Expressões correlacionadas da lista de conversas, extraídas para poderem ser renderizadas e
// verificadas sem banco (ver SessionRepository.test.ts).
//
// A correlação usa `${sessions}.company_id` e NÃO `${sessions.companyId}`: dentro da lista de
// seleção o drizzle renderiza a referência de coluna sem qualificar a tabela, e um
// `"company_id"` solto dentro do subselect resolve para a coluna de `m`. O resultado seria
// `m.company_id = m.company_id` (sempre verdadeiro) e `m.session_id = m.id` (nunca) — zero
// linhas, NULL, e nenhum erro.
export const conversationSummaryProjection = {
  lastContent: sql<string | null>`(
    select m.content from ${messages} m
    where m.company_id = ${sessions}.company_id and m.session_id = ${sessions}.id
    order by m.created_at desc limit 1
  )`,
  lastDirection: sql<string | null>`(
    select m.direction from ${messages} m
    where m.company_id = ${sessions}.company_id and m.session_id = ${sessions}.id
    order by m.created_at desc limit 1
  )`,
  // Entradas do cliente depois da última leitura do atendente. Sessão nunca lida conta
  // tudo — é o comportamento esperado de uma conversa que ninguém abriu ainda.
  unread: sql<number>`(
    select count(*)::int from ${messages} m
    where m.company_id = ${sessions}.company_id
      and m.session_id = ${sessions}.id
      and m.direction = 'inbound'
      and (${sessions}.last_agent_read_at is null or m.created_at > ${sessions}.last_agent_read_at)
  )`,
} as const

// Mescla do context feita pelo Postgres. Extraída para ser verificável sem banco (ver
// SessionRepository.test.ts): o `::jsonb` é obrigatório — sem ele o parâmetro chega como text e
// o `||` concatena strings em vez de mesclar objetos, corrompendo o context em silêncio.
export function sessionContextPatch(patch: Record<string, unknown>) {
  return sql`${sessions.context} || ${JSON.stringify(patch)}::jsonb`
}

// T3.2 — todo método recebe/filtra por companyId explicitamente (nunca lê de um campo do
// payload do cliente); ver database.md "Consistência e multiempresa".
export class SessionRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  async getContext(companyId: string, whatsappNumber: string): Promise<SessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
      .limit(1)
    return row
  }

  async getOrCreate(companyId: string, whatsappNumber: string, startState: SessionState): Promise<SessionRow> {
    const existing = await this.getContext(companyId, whatsappNumber)
    if (existing) return existing

    const [created] = await this.db
      .insert(sessions)
      .values({ companyId, whatsappNumber, currentState: startState })
      .onConflictDoUpdate({
        target: [sessions.companyId, sessions.whatsappNumber],
        set: { lastActivity: sql`now()` },
      })
      .returning()
    return created!
  }

  // O `context` jsonb é o ponto de extensão oficial para estado de sessão por produto: o módulo
  // não conhece a forma, o consumidor a declara em TSessionContext. Este setter SUBSTITUI o
  // objeto inteiro — para acumular respostas ao longo da conversa use patchContext.
  async setState<TSessionContext extends Record<string, unknown> = Record<string, unknown>>(
    companyId: string,
    whatsappNumber: string,
    state: SessionState,
    context?: TSessionContext,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        currentState: state,
        ...(context !== undefined ? { context } : {}),
        lastActivity: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  // Mescla parcial do context, feita no banco (`||`) e não por read-modify-write no host: duas
  // mensagens do mesmo cliente processadas em paralelo sobrescreveriam uma à outra, e o campo
  // acumula justamente as respostas coletadas ao longo da conversa. Chave presente no patch
  // vence a existente; as demais permanecem.
  async patchContext<TSessionContext extends Record<string, unknown> = Record<string, unknown>>(
    companyId: string,
    whatsappNumber: string,
    patch: Partial<TSessionContext>,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        context: sessionContextPatch(patch),
        lastActivity: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  // Leitura tipada do estado de sessão do produto. Devolve undefined quando a sessão não existe —
  // distinto de existir com context vazio, que devolve o objeto vazio.
  async readContext<TSessionContext extends Record<string, unknown> = Record<string, unknown>>(
    companyId: string,
    whatsappNumber: string,
  ): Promise<TSessionContext | undefined> {
    const [row] = await this.db
      .select({ context: sessions.context })
      .from(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
      .limit(1)
    return row?.context as TSessionContext | undefined
  }

  // Posição no grafo de fluxo — chamado pelo host a cada transição do FlowInterpreter.
  // Passar null em ambos desliga o rastreio (ex.: conversa saiu do motor de fluxo).
  async setFlowPosition(
    companyId: string,
    whatsappNumber: string,
    flowKey: string | null,
    currentNodeId: string | null,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ flowKey, currentNodeId, lastActivity: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  // Marca a chegada de uma mensagem DO CLIENTE. É este carimbo — e não lastActivity, que também
  // se move em ações do atendente/bot — que define a janela de 24h do WhatsApp: fora dela, só
  // template aprovado reabre a conversa (ver WindowExpiredError nos contracts).
  async touchInbound(companyId: string, whatsappNumber: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastInboundAt: sql`now()`, lastActivity: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  // Horas desde a última mensagem do cliente — undefined se ele nunca escreveu. O canal (Fase 5)
  // usa isto para decidir entre mensagem livre e template antes de chamar a Graph API.
  async hoursSinceLastInbound(companyId: string, whatsappNumber: string): Promise<number | undefined> {
    const session = await this.getContext(companyId, whatsappNumber)
    if (!session?.lastInboundAt) return undefined
    return (Date.now() - session.lastInboundAt.getTime()) / (1000 * 60 * 60)
  }

  async setMode(
    companyId: string,
    whatsappNumber: string,
    mode: SessionMode,
    assignedUserId?: string | null,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ mode, assignedUserId: assignedUserId ?? null, updatedAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  // T3.3 — takeover: atendente assume a conversa, tirando-a do modo bot.
  async takeover(companyId: string, whatsappNumber: string, agentUserId: string): Promise<void> {
    await this.setMode(companyId, whatsappNumber, 'human', agentUserId)
  }

  // T3.3 — release: devolve a conversa ao bot.
  async release(companyId: string, whatsappNumber: string): Promise<void> {
    await this.setMode(companyId, whatsappNumber, 'bot', null)
  }

  /**
   * Apaga a sessão; a cascata das FKs leva mensagens e documentos.
   *
   * Não apaga o binário no storage — isso é passo de aplicação, e é por isso que este método é
   * chamado por `DeleteConversationUseCase` e não diretamente pelo host. Chamar daqui sem apagar os
   * objetos antes deixa mídia órfã sendo cobrada para sempre.
   */
  async deleteByNumber(companyId: string, whatsappNumber: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  async requestHuman(companyId: string, whatsappNumber: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ humanRequestedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  async markRead(companyId: string, whatsappNumber: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastAgentReadAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
  }

  async markAllRead(companyId: string, userId: string): Promise<number> {
    const result = await this.db
      .update(sessions)
      .set({ lastAgentReadAt: sql`now()` })
      .where(and(eq(sessions.companyId, companyId), eq(sessions.assignedUserId, userId)))
    return Number((result as unknown as { rowCount?: number }).rowCount ?? 0)
  }

  async listByContextFilters(companyId: string, filters: ListConversationsFilters): Promise<ConversationSummary[]> {
    const limit = filters.limit ?? DEFAULT_LIMIT
    const offset = ((filters.page ?? 1) - 1) * limit

    const conditions = [eq(sessions.companyId, companyId)]
    if (filters.waitingHuman) conditions.push(sql`${sessions.humanRequestedAt} is not null`)
    if (filters.search) conditions.push(sql`${sessions.whatsappNumber} ilike ${'%' + filters.search + '%'}`)

    const rows = await this.db
      .select({
        id: sessions.id,
        whatsappNumber: sessions.whatsappNumber,
        mode: sessions.mode,
        assignedUserId: sessions.assignedUserId,
        currentState: sessions.currentState,
        lastActivity: sessions.lastActivity,
        lastInboundAt: sessions.lastInboundAt,
        humanRequestedAt: sessions.humanRequestedAt,
        // Prévia e contagem saem de subquery correlacionada em vez de N+1 na volta: uma inbox
        // lista dezenas de conversas por página, e uma query por linha é o gargalo clássico
        // dessa tela. Ambos os campos são dados do próprio módulo — deixá-los para o host
        // obrigaria todo consumidor a reescrever o mesmo join contra tabelas que não são dele.
        ...conversationSummaryProjection,
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.lastActivity))
      .limit(limit)
      .offset(offset)

    return rows.map((row) => ({
      id: row.id,
      whatsappNumber: row.whatsappNumber,
      ...(row.lastContent !== null ? { lastContent: row.lastContent } : {}),
      ...(row.lastDirection !== null ? { lastDirection: row.lastDirection as MessageDirection } : {}),
      lastAt: row.lastActivity.toISOString(),
      lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
      mode: row.mode as SessionMode,
      assignedUserId: row.assignedUserId,
      waitingHuman: row.humanRequestedAt !== null,
      unread: Number(row.unread),
      currentState: row.currentState,
    }))
  }

  // T3.3 — export: transcript completo de uma conversa, mensagens em ordem cronológica.
  async exportConversation(companyId: string, whatsappNumber: string) {
    const session = await this.getContext(companyId, whatsappNumber)
    if (!session) return null

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.companyId, companyId), eq(messages.sessionId, session.id)))
      .orderBy(messages.createdAt)

    return { session, messages: rows }
  }
}
