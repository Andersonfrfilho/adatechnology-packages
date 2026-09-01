/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Isolamento multiempresa (T1.6): renderiza o SQL real de cada condição exportada com `PgDialect`
 * e prova que `company_id` está em toda cláusula — sem precisar de Postgres.
 *
 * O valor está em travar **as funções que a produção chama**. Reconstruir a condição aqui
 * testaria o teste.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import {
  catalogListCondition,
  catalogOwnedByCondition,
  productEmbeddingOwnedByCondition,
  productEmbeddingSearchCondition,
  productListCondition,
  productOwnedByCondition,
  productSearchCondition,
  sectionListCondition,
  sectionOwnedByCondition,
} from './conditions'

const dialect = new PgDialect()
const render = (expression: SQL): string => dialect.sqlToQuery(expression).sql
const renderParams = (expression: SQL): readonly unknown[] => dialect.sqlToQuery(expression).params

const params = { companyId: 'company-a', id: 'row-1', search: 'leite' }

describe('toda condição escopa por company_id', () => {
  const conditions: Record<string, SQL> = {
    productOwnedByCondition: productOwnedByCondition(params),
    productListCondition: productListCondition(params),
    productSearchCondition: productSearchCondition(params),
    productEmbeddingSearchCondition: productEmbeddingSearchCondition({ companyId: params.companyId, model: 'clip' }),
    productEmbeddingOwnedByCondition: productEmbeddingOwnedByCondition({
      companyId: params.companyId,
      productId: params.id,
    }),
    catalogOwnedByCondition: catalogOwnedByCondition(params),
    catalogListCondition: catalogListCondition(params),
    sectionOwnedByCondition: sectionOwnedByCondition(params),
    sectionListCondition: sectionListCondition(params),
  }

  for (const [name, condition] of Object.entries(conditions)) {
    it(`${name} inclui company_id`, () => {
      expect(render(condition)).toContain('company_id')
    })
  }

  it('empresas diferentes vinculam parâmetros diferentes', () => {
    const companyA = productListCondition({ companyId: 'company-a' })
    const companyB = productListCondition({ companyId: 'company-b' })

    expect(render(companyA)).toEqual(render(companyB))
    expect(renderParams(companyA)).toContain('company-a')
    expect(renderParams(companyB)).not.toContain('company-a')
  })
})

describe('soft delete não vaza registro apagado', () => {
  it('produto e catálogo filtram deleted_at is null por construção', () => {
    expect(render(productOwnedByCondition(params))).toContain('deleted_at')
    expect(render(productListCondition(params))).toContain('deleted_at')
    expect(render(catalogOwnedByCondition(params))).toContain('deleted_at')
    expect(render(catalogListCondition(params))).toContain('deleted_at')
  })

  it('seção não tem soft delete — e é decisão, não esquecimento', () => {
    // `products.sectionId` é ON DELETE SET NULL: o produto sobrevive à remoção da seção, e nada
    // no histórico de pedido referencia seção.
    expect(render(sectionOwnedByCondition(params))).not.toContain('deleted_at')
  })
})

describe('busca casa o índice GIN', () => {
  it('usa ilike com curinga dos dois lados, que é o que gin_trgm_ops acelera', () => {
    const sql = render(productSearchCondition(params))

    expect(sql.toLowerCase()).toContain('ilike')
    // O termo vai como parâmetro vinculado, não interpolado — SQL injection não passa por aqui.
    expect(renderParams(productSearchCondition(params))).toContain('%leite%')
    expect(sql).not.toContain('leite')
  })
})

describe('id sozinho nunca basta', () => {
  it('a condição de posse compõe company_id E id, sempre', () => {
    const sql = render(productOwnedByCondition(params))

    expect(sql).toContain('company_id')
    expect(sql).toContain('"id"')
  })
})

describe('a busca por texto cobre como o cliente fala', () => {
  it('procura em nome, marca e apelido', () => {
    // "guarana" nao e o nome cadastrado de nenhum refrigerante, e e o que o cliente digita.
    const rendered = render(productSearchCondition({ companyId: 'company-a', search: 'guarana' }))

    expect(rendered).toContain('"name" ilike')
    expect(rendered).toContain('"brand"')
    expect(rendered).toContain('"aliases"')
  })

  it('sem perder o escopo de empresa ao ganhar campos', () => {
    // O `or` dos tres campos precisa estar dentro do `and` do tenant: solto, a busca por marca
    // atravessaria empresas.
    const rendered = render(productSearchCondition({ companyId: 'company-a', search: 'x' }))

    expect(rendered.indexOf('company_id')).toBeLessThan(rendered.indexOf('ilike'))
  })
})
