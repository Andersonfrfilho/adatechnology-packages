import { and, desc, eq, sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type { ConversationSummary, SessionMode, SessionState } from '@adatechnology/meta-whatsapp-contracts'
import { messages, sessions, type SessionRow } from '../schema/schema'

export interface ListConversationsFilters {
  page?: number
  limit?: number
  waitingHuman?: boolean
  search?: string
}

const DEFAULT_LIMIT = 20

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

  async setState(
    companyId: string,
    whatsappNumber: string,
    state: SessionState,
    context?: Record<string, unknown>,
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
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.lastActivity))
      .limit(limit)
      .offset(offset)

    return rows.map((row) => ({
      id: row.id,
      whatsappNumber: row.whatsappNumber,
      lastAt: row.lastActivity.toISOString(),
      lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
      mode: row.mode as SessionMode,
      assignedUserId: row.assignedUserId,
      waitingHuman: row.humanRequestedAt !== null,
      unread: 0, // calculado pelo host (agregação com companyId + regra de leitura própria)
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
