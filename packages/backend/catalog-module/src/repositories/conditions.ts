/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição de leitura/escrita alcançável por uma requisição vive aqui, como **função pura
 * exportada** — e é a mesma função que o repositório chama e que o teste de isolamento renderiza.
 *
 * O ganho sobre escrever o `where` inline: um refactor que esqueça o filtro de empresa quebra o
 * teste na hora, porque o teste não reconstrói a lógica — ele exercita o código de produção.
 */

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'

import { catalogs, products, sections } from '../schema/schema'
import { productEmbeddings } from '../schema/vision.schema'

export function productOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(products.companyId, params.companyId), eq(products.id, params.id), isNull(products.deletedAt))!
}

export function productListCondition(params: { companyId: string }): SQL {
  return and(eq(products.companyId, params.companyId), isNull(products.deletedAt))!
}

/**
 * Busca por trigrama, casando o índice GIN. `ILIKE '%termo%'` é o operador que o `gin_trgm_ops`
 * acelera — trocar por `=` ou por prefixo deixaria o índice sem uso.
 */
export function productSearchCondition(params: { companyId: string; search: string }): SQL {
  return and(productListCondition(params), sql`${products.name} ilike ${'%' + params.search + '%'}`)!
}

export function catalogOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(catalogs.companyId, params.companyId), eq(catalogs.id, params.id), isNull(catalogs.deletedAt))!
}

export function catalogListCondition(params: { companyId: string }): SQL {
  return and(eq(catalogs.companyId, params.companyId), isNull(catalogs.deletedAt))!
}

export function sectionOwnedByCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(sections.companyId, params.companyId), eq(sections.id, params.id))!
}

export function sectionListCondition(params: { companyId: string }): SQL {
  return eq(sections.companyId, params.companyId)
}

/**
 * Busca visual: escopa a empresa **na tabela de vetores e no produto**, porque a consulta junta as
 * duas. Filtrar só uma das pontas deixaria o vizinho mais próximo de outra empresa entrar no
 * resultado por dentro do join — e o índice HNSW nem percebe fronteira de tenant, ele ordena o
 * espaço inteiro.
 */
export function productEmbeddingSearchCondition(params: { companyId: string; model: string }): SQL {
  return and(
    eq(productEmbeddings.companyId, params.companyId),
    eq(productEmbeddings.model, params.model),
    eq(products.companyId, params.companyId),
    eq(products.active, true),
    isNull(products.deletedAt),
  )!
}

export function productEmbeddingOwnedByCondition(params: { companyId: string; productId: string }): SQL {
  return and(eq(productEmbeddings.companyId, params.companyId), eq(productEmbeddings.productId, params.productId))!
}
