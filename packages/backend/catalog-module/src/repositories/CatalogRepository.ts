/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

import type { CatalogDatabase } from '../database.types'
import { catalogs, products, type CatalogRow, type NewCatalogRow } from '../schema/schema'
import { catalogListCondition, catalogOwnedByCondition } from './conditions'

export type ListCatalogsQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly search?: string
  readonly active?: boolean
}

export type CatalogWithCount = CatalogRow & { readonly productCount: number }

export class CatalogRepository {
  constructor(private readonly db: CatalogDatabase) {}

  async create(values: NewCatalogRow): Promise<CatalogRow> {
    const [row] = await this.db.insert(catalogs).values(values).returning()
    if (!row) throw new Error('catalog-module: insert em catalogs não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<CatalogRow | undefined> {
    const [row] = await this.db.select().from(catalogs).where(catalogOwnedByCondition(params)).limit(1)
    return row
  }

  /**
   * `productCount` por subquery correlacionada, não por join com `group by`: o join derrubaria
   * catálogo vazio da lista (ou exigiria `left join` + `having`), e catálogo recém-criado sem
   * produto é o estado normal logo depois de criar.
   */
  async list(query: ListCatalogsQuery): Promise<{ rows: CatalogWithCount[]; total: number }> {
    const conditions = [catalogListCondition(query)]
    if (query.search) conditions.push(sql`${catalogs.name} ilike ${'%' + query.search + '%'}`)
    if (query.active !== undefined) conditions.push(eq(catalogs.active, query.active))

    const where = and(...conditions)
    const productCount = catalogProductCountSql()

    const [rows, [counted]] = await Promise.all([
      this.db
        .select({
          id: catalogs.id,
          companyId: catalogs.companyId,
          name: catalogs.name,
          description: catalogs.description,
          active: catalogs.active,
          sortOrder: catalogs.sortOrder,
          externalId: catalogs.externalId,
          syncStatus: catalogs.syncStatus,
          syncError: catalogs.syncError,
          deletedAt: catalogs.deletedAt,
          createdAt: catalogs.createdAt,
          updatedAt: catalogs.updatedAt,
          productCount,
        })
        .from(catalogs)
        .where(where)
        .orderBy(asc(catalogs.sortOrder), asc(catalogs.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(catalogs)
        .where(where),
    ])

    return { rows: rows as CatalogWithCount[], total: counted?.value ?? 0 }
  }

  /** Nomes dos catálogos vivos da empresa, para a listagem de produto trazer `catalogName`. */
  async findNamesByIds(params: {
    companyId: string
    ids: readonly string[]
  }): Promise<Array<{ id: string; name: string }>> {
    if (params.ids.length === 0) return []
    return this.db
      .select({ id: catalogs.id, name: catalogs.name })
      .from(catalogs)
      .where(
        and(
          eq(catalogs.companyId, params.companyId),
          inArray(catalogs.id, [...params.ids]),
          isNull(catalogs.deletedAt),
        ),
      )
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewCatalogRow>
  }): Promise<CatalogRow | undefined> {
    const [row] = await this.db
      .update(catalogs)
      .set({ ...params.values, updatedAt: new Date() })
      .where(catalogOwnedByCondition(params))
      .returning()
    return row
  }

  async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .update(catalogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(catalogOwnedByCondition(params))
      .returning({ id: catalogs.id })
    return row !== undefined
  }

  async markSync(params: {
    companyId: string
    id: string
    syncStatus: string
    externalId?: string
    syncError?: string | null
  }): Promise<void> {
    await this.db
      .update(catalogs)
      .set({
        syncStatus: params.syncStatus,
        externalId: params.externalId,
        syncError: params.syncError ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(catalogs.companyId, params.companyId), eq(catalogs.id, params.id), isNull(catalogs.deletedAt)))
  }
}

function qualifiedCatalogColumn(columnName: string): SQL {
  const { schema, name } = getTableConfig(catalogs)
  return sql`${sql.identifier(schema ?? 'public')}.${sql.identifier(name)}.${sql.identifier(columnName)}`
}

/**
 * O lado externo da correlação vai qualificado à mão: numa consulta de uma tabela só o Drizzle
 * escreve a coluna sem o nome da tabela, e dentro da subquery `"id"` passava a ser `products.id`
 * — a contagem saía sempre 0.
 */
export function catalogProductCountSql(): SQL<number> {
  return sql<number>`(
      select count(*)::int from ${products}
      where ${products.catalogId} = ${qualifiedCatalogColumn(catalogs.id.name)}
        and ${products.companyId} = ${qualifiedCatalogColumn(catalogs.companyId.name)}
        and ${products.deletedAt} is null
    )`
}
