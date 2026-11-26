import { and, asc, count, eq, ilike, max, ne, or, sql, type SQL } from 'drizzle-orm'
import {
  QuickReplyLimitReachedError,
  QuickReplyNotFoundError,
  QuickReplyShortcutTakenError,
  QUICK_REPLY_LIMITS,
  type WhatsAppQuickReplyInput,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MetaWhatsAppDatabase } from '../database.types'
import { quickReplies, type QuickReplyRow } from '../schema/schema'

const UNIQUE_VIOLATION_SQLSTATE = '23505'

// O SQLSTATE vem em `code` (pg, postgres-js) ou em `errno` (Bun.sql, onde `code` é genérico), e o
// drizzle 1.x embrulha o erro do driver em `cause`: olha os dois campos nos dois níveis.
function hasUniqueViolationState(error: unknown): boolean {
  const state = error as { code?: unknown; errno?: unknown } | null
  return state?.code === UNIQUE_VIOLATION_SQLSTATE || state?.errno === UNIQUE_VIOLATION_SQLSTATE
}

function isUniqueViolation(error: unknown): boolean {
  return hasUniqueViolationState(error) || hasUniqueViolationState((error as { cause?: unknown } | null)?.cause)
}

// `%`, `_` e `\` do que o usuário digitou são literais, não curinga do LIKE.
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export type ListQuickRepliesParams = {
  companyId: string
  search?: string
}

export type CreateQuickReplyParams = WhatsAppQuickReplyInput & { companyId: string }
export type UpdateQuickReplyParams = WhatsAppQuickReplyInput & { companyId: string; id: string }

// Toda consulta é escopada por companyId: o id da resposta é um UUID que o cliente manda, e filtrar
// só por ele deixaria uma empresa editar ou apagar a resposta de outra.
export class QuickReplyRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  async list(params: ListQuickRepliesParams): Promise<QuickReplyRow[]> {
    const filters: SQL[] = [eq(quickReplies.companyId, params.companyId)]
    if (params.search) {
      const pattern = `%${escapeLikePattern(params.search)}%`
      const matches = or(
        ilike(quickReplies.title, pattern),
        ilike(quickReplies.shortcut, pattern),
        ilike(quickReplies.body, pattern),
      )
      if (matches) filters.push(matches)
    }
    return this.db
      .select()
      .from(quickReplies)
      .where(and(...filters))
      .orderBy(asc(quickReplies.sortOrder), asc(quickReplies.title), asc(quickReplies.id))
  }

  async get(companyId: string, id: string): Promise<QuickReplyRow | undefined> {
    const [row] = await this.db
      .select()
      .from(quickReplies)
      .where(and(eq(quickReplies.companyId, companyId), eq(quickReplies.id, id)))
      .limit(1)
    return row
  }

  async create(params: CreateQuickReplyParams): Promise<QuickReplyRow> {
    const [totals] = await this.db
      .select({ total: count(), highestOrder: max(quickReplies.sortOrder) })
      .from(quickReplies)
      .where(eq(quickReplies.companyId, params.companyId))
    if ((totals?.total ?? 0) >= QUICK_REPLY_LIMITS.MAX_PER_COMPANY) {
      throw new QuickReplyLimitReachedError(QUICK_REPLY_LIMITS.MAX_PER_COMPANY)
    }

    try {
      const [row] = await this.db
        .insert(quickReplies)
        .values({
          companyId: params.companyId,
          title: params.title,
          shortcut: params.shortcut,
          body: params.body,
          // Sem ordem explícita vai para o fim da lista.
          sortOrder: params.sortOrder ?? (totals?.highestOrder ?? -1) + 1,
        })
        .returning()
      return row!
    } catch (error) {
      if (isUniqueViolation(error)) throw new QuickReplyShortcutTakenError(params.shortcut)
      throw error
    }
  }

  async update(params: UpdateQuickReplyParams): Promise<QuickReplyRow> {
    const [taken] = await this.db
      .select({ id: quickReplies.id })
      .from(quickReplies)
      .where(
        and(
          eq(quickReplies.companyId, params.companyId),
          eq(quickReplies.shortcut, params.shortcut),
          ne(quickReplies.id, params.id),
        ),
      )
      .limit(1)
    if (taken) throw new QuickReplyShortcutTakenError(params.shortcut)

    try {
      const [row] = await this.db
        .update(quickReplies)
        .set({
          title: params.title,
          shortcut: params.shortcut,
          body: params.body,
          ...(params.sortOrder !== undefined ? { sortOrder: params.sortOrder } : {}),
          updatedAt: sql`now()`,
        })
        .where(and(eq(quickReplies.companyId, params.companyId), eq(quickReplies.id, params.id)))
        .returning()
      if (!row) throw new QuickReplyNotFoundError(params.id)
      return row
    } catch (error) {
      // Corrida entre a checagem acima e o UPDATE: o índice único é quem decide de verdade.
      if (isUniqueViolation(error)) throw new QuickReplyShortcutTakenError(params.shortcut)
      throw error
    }
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(quickReplies)
      .where(and(eq(quickReplies.companyId, companyId), eq(quickReplies.id, id)))
      .returning({ id: quickReplies.id })
    return rows.length > 0
  }
}
