/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * REGRESSÃO: `productCount` voltava sempre 0. Numa consulta de tabela única o Drizzle escreve a
 * coluna sem o nome da tabela, e a correlação virava `"catalog_id" = "id"` — dentro da subquery,
 * os dois lados eram de `products`.
 */

import { describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/node-postgres'

import { catalogs } from '../schema/schema'
import { catalogProductCountSql } from './CatalogRepository'

describe('contagem de produtos por catálogo', () => {
  it('correlaciona com a coluna qualificada do catálogo externo', () => {
    const query = drizzle.mock().select({ id: catalogs.id, productCount: catalogProductCountSql() }).from(catalogs)
    const rendered = query.toSQL().sql

    expect(rendered).toContain('"catalog_id" = "catalog"."catalogs"."id"')
    expect(rendered).toContain('"company_id" = "catalog"."catalogs"."company_id"')
  })
})
