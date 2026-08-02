/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, sql, type SQL } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { preferences, type PreferenceRow } from '../schema/schema'

// Exportada para o teste de isolamento (T3.5) — mesmo raciocínio de `NotificationRepository`.
export function preferenceByUserCondition(params: { companyId: string; userId: string }): SQL {
  return and(eq(preferences.companyId, params.companyId), eq(preferences.userId, params.userId))!
}

export type PreferenceUpsertInput = {
  readonly category: string
  readonly channel: string
  readonly enabled: boolean
  readonly quietHoursStart?: string
  readonly quietHoursEnd?: string
  readonly timezone?: string
}

export class PreferenceRepository {
  constructor(private readonly db: NotificationDatabase) {}

  async listByUser(params: { companyId: string; userId: string }): Promise<PreferenceRow[]> {
    return this.db.select().from(preferences).where(preferenceByUserCondition(params))
  }

  async findOne(params: {
    companyId: string
    userId: string
    category: string
    channel: string
  }): Promise<PreferenceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(preferences)
      .where(
        and(
          eq(preferences.companyId, params.companyId),
          eq(preferences.userId, params.userId),
          eq(preferences.category, params.category),
          eq(preferences.channel, params.channel),
        ),
      )
      .limit(1)
    return row
  }

  /**
   * Uma única instrução `INSERT ... ON CONFLICT DO UPDATE` para o lote inteiro — não um upsert
   * por linha em loop (`nodejs.md`, "nunca `await` dentro de loop"). `excluded.*` no `set`
   * aplica o valor de cada linha nova à sua própria colisão, não um valor fixo compartilhado.
   */
  async upsertMany(params: {
    companyId: string
    userId: string
    preferences: readonly PreferenceUpsertInput[]
  }): Promise<PreferenceRow[]> {
    if (params.preferences.length === 0) return []

    const rows = params.preferences.map((preference) => ({
      companyId: params.companyId,
      userId: params.userId,
      category: preference.category,
      channel: preference.channel,
      enabled: preference.enabled,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
      timezone: preference.timezone,
    }))

    return this.db
      .insert(preferences)
      .values(rows)
      .onConflictDoUpdate({
        target: [preferences.companyId, preferences.userId, preferences.category, preferences.channel],
        set: {
          enabled: sql`excluded.enabled`,
          quietHoursStart: sql`excluded.quiet_hours_start`,
          quietHoursEnd: sql`excluded.quiet_hours_end`,
          timezone: sql`excluded.timezone`,
          updatedAt: new Date(),
        },
      })
      .returning()
  }
}
