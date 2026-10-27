/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq, isNull } from 'drizzle-orm'

import type { CustomerDatabase } from '../database.types'
import { customerSettings } from '../schema/schema'
import type { CustomerSettingsRow } from '../schema/schema'

export class SettingsRepository {
  constructor(private readonly db: CustomerDatabase) {}

  private scope(companyId: string | undefined) {
    return companyId === undefined ? isNull(customerSettings.companyId) : eq(customerSettings.companyId, companyId)
  }

  async find(companyId: string | undefined): Promise<CustomerSettingsRow | undefined> {
    const [row] = await this.db.select().from(customerSettings).where(this.scope(companyId)).limit(1)
    return row
  }

  /**
   * A linha nasce na primeira leitura, não numa migration.
   *
   * Semear pela migration daria à instalação uma configuração que o pacote escolheu; nascer vazia
   * na primeira leitura deixa o padrão vir do código, num lugar só, e mudar com o upgrade.
   */
  async findOrCreate(companyId: string | undefined): Promise<CustomerSettingsRow> {
    const existing = await this.find(companyId)
    if (existing) return existing

    const [created] = await this.db
      .insert(customerSettings)
      .values({ ...(companyId ? { companyId } : {}) })
      .onConflictDoNothing()
      .returning()

    // `onConflictDoNothing` devolve vazio quando outra requisição criou primeiro — aí a dela vale.
    return created ?? (await this.find(companyId))!
  }

  async update(params: {
    companyId: string | undefined
    maskPhoneInList: boolean
    documentCatalog: unknown
    fieldCatalog: unknown
    updatedByUserId?: string
  }): Promise<CustomerSettingsRow> {
    const [row] = await this.db
      .update(customerSettings)
      .set({
        maskPhoneInList: params.maskPhoneInList,
        documentCatalog: params.documentCatalog,
        fieldCatalog: params.fieldCatalog,
        updatedAt: new Date(),
        ...(params.updatedByUserId ? { updatedByUserId: params.updatedByUserId } : {}),
      })
      .where(this.scope(params.companyId))
      .returning()

    return row!
  }
}
