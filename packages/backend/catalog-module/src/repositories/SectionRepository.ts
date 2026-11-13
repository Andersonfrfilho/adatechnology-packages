/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, isNull, or } from 'drizzle-orm'

import type { CatalogDatabase } from '../database.types'
import { sections, type NewSectionRow, type SectionRow } from '../schema/schema'
import { sectionListCondition, sectionOwnedByCondition } from './conditions'

export class SectionRepository {
  constructor(private readonly db: CatalogDatabase) {}

  async create(values: NewSectionRow): Promise<SectionRow> {
    const [row] = await this.db.insert(sections).values(values).returning()
    if (!row) throw new Error('catalog-module: insert em sections não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<SectionRow | undefined> {
    const [row] = await this.db.select().from(sections).where(sectionOwnedByCondition(params)).limit(1)
    return row
  }

  /**
   * Sem paginação: seção é lista curta por natureza (postos de produção, corredores de mercado) e
   * a UI a usa como select. Paginar um select seria pior interface e mais código.
   */
  async listByCompany(params: { companyId: string; catalogId?: string }): Promise<SectionRow[]> {
    const conditions = [sectionListCondition(params)]
    // Filtrar por catálogo devolve as seções daquele catálogo **e as globais** (`catalogId is
    // null`), porque seção sem catálogo vale para todos — trazer só as amarradas esconderia
    // metade das opções do select.
    if (params.catalogId) {
      conditions.push(or(eq(sections.catalogId, params.catalogId), isNull(sections.catalogId))!)
    }

    return this.db
      .select()
      .from(sections)
      .where(and(...conditions))
      .orderBy(asc(sections.sortOrder), asc(sections.name))
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewSectionRow>
  }): Promise<SectionRow | undefined> {
    const [row] = await this.db
      .update(sections)
      .set({ ...params.values, updatedAt: new Date() })
      .where(sectionOwnedByCondition(params))
      .returning()
    return row
  }

  /** Sem soft delete: seção não é referenciada por pedido histórico — `products.sectionId` já é
   * `ON DELETE SET NULL`, e o produto sobrevive à remoção da seção. */
  async delete(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db.delete(sections).where(sectionOwnedByCondition(params)).returning({ id: sections.id })
    return row !== undefined
  }
}
