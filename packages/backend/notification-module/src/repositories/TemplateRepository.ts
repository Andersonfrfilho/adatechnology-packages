/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, desc, eq } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { templates, type TemplateRow } from '../schema/schema'

export type UpsertTemplateInput = {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly subject?: string
  readonly body: string
  readonly whatsappTemplateName?: string
  readonly active: boolean
}

export class TemplateRepository {
  constructor(private readonly db: NotificationDatabase) {}

  /** A versão ativa mais alta — versões antigas continuam legíveis para auditoria, nunca lidas por engano. */
  async findActive(params: {
    companyId: string
    key: string
    channel: string
    locale: string
  }): Promise<TemplateRow | undefined> {
    const [row] = await this.db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.companyId, params.companyId),
          eq(templates.key, params.key),
          eq(templates.channel, params.channel),
          eq(templates.locale, params.locale),
          eq(templates.active, true),
        ),
      )
      .orderBy(desc(templates.version))
      .limit(1)
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<TemplateRow | undefined> {
    const [row] = await this.db
      .select()
      .from(templates)
      .where(and(eq(templates.companyId, params.companyId), eq(templates.id, params.id)))
      .limit(1)
    return row
  }

  /**
   * Desativa TODAS as versões ativas da identidade, não só a linha apontada.
   *
   * Desativar uma versão só ressuscitaria a anterior — `findActive` pega a maior ativa, então o
   * envio passaria a usar um texto mais velho, que é o oposto do que "remover" significa na tela.
   * A linha continua existindo: entrega já enviada precisa continuar auditável.
   */
  async deactivateIdentity(params: {
    companyId: string
    key: string
    channel: string
    locale: string
  }): Promise<number> {
    const rows = await this.db
      .update(templates)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(templates.companyId, params.companyId),
          eq(templates.key, params.key),
          eq(templates.channel, params.channel),
          eq(templates.locale, params.locale),
          eq(templates.active, true),
        ),
      )
      .returning({ id: templates.id })
    return rows.length
  }

  async listByCompany(params: { companyId: string }): Promise<TemplateRow[]> {
    return this.db.select().from(templates).where(eq(templates.companyId, params.companyId))
  }

  /**
   * Cada chamada cria uma **versão nova** — templates são histórico imutável, nunca sobrescreve
   * o corpo de uma versão já publicada (uma notificação enviada precisa continuar auditável com
   * o texto que ela realmente usou).
   */
  async upsert(params: { companyId: string } & UpsertTemplateInput): Promise<TemplateRow> {
    const [current] = await this.db
      .select({ version: templates.version })
      .from(templates)
      .where(
        and(
          eq(templates.companyId, params.companyId),
          eq(templates.key, params.key),
          eq(templates.channel, params.channel),
          eq(templates.locale, params.locale),
        ),
      )
      .orderBy(desc(templates.version))
      .limit(1)

    const [row] = await this.db
      .insert(templates)
      .values({
        companyId: params.companyId,
        key: params.key,
        channel: params.channel,
        locale: params.locale,
        subject: params.subject,
        body: params.body,
        whatsappTemplateName: params.whatsappTemplateName,
        active: params.active,
        version: (current?.version ?? 0) + 1,
      })
      .returning()
    if (!row) throw new Error('notification-module: insert em templates não retornou linha')
    return row
  }
}
