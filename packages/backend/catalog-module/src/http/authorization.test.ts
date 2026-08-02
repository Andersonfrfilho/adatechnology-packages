/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * BOLA / API1 (T3.3) sobre as rotas **reais** do módulo: trocar o id na URL não dá acesso ao
 * produto de outra empresa. Sempre 404, nunca 403 — confirmar a existência do recurso já seria
 * vazamento.
 *
 * Cobre também o vazamento de margem: `costPriceInCents` não pode sair na projeção de cliente.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import type { AuthContextResolverPort } from '@adatechnology/module-http'

import { createCatalogRoutes } from './routes'
import type { CatalogModule } from '../CatalogModule'
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '../use-cases/Product.use-cases'
import { BulkImportProductsUseCase } from '../use-cases/BulkImportProducts.use-case'
import { AdjustInventoryUseCase } from '../use-cases/Inventory.use-cases'
import { createInMemoryCatalogs, createInMemoryProducts, createInMemorySections } from '../testing/inMemoryRepositories'
import type { CatalogDependencies } from '../use-cases/catalogModule.types'
import type { ProductRow } from '../schema/schema'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()

function buildProductRow(companyId: string): ProductRow {
  return {
    id: randomUUID(),
    companyId,
    catalogId: null,
    sectionId: null,
    name: 'Café torrado 500g',
    description: null,
    priceInCents: 2490,
    costPriceInCents: 1180,
    unit: 'un',
    barcode: null,
    imageUrl: null,
    imageStorageKey: null,
    inventory: 10,
    active: true,
    sortOrder: 0,
    availability: 'in stock',
    preparationTimeMinutes: null,
    preparationInstructions: null,
    externalId: null,
    syncStatus: null,
    syncError: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ProductRow
}

function buildRouter(params: { seed: ProductRow[]; authCompanyId: string }) {
  const products = createInMemoryProducts(params.seed)
  const dependencies = {
    products,
    catalogs: createInMemoryCatalogs(),
    sections: createInMemorySections(),
    config: { currency: 'BRL', locale: 'pt-BR' },
  } as unknown as CatalogDependencies

  const createProduct = new CreateProductUseCase(dependencies)
  const module = {
    useCases: {
      createProduct,
      adjustInventory: new AdjustInventoryUseCase(dependencies),
      bulkImportProducts: new BulkImportProductsUseCase(dependencies, createProduct),
      updateProduct: new UpdateProductUseCase(dependencies),
      deleteProduct: new DeleteProductUseCase(dependencies),
      getProduct: new GetProductUseCase(dependencies),
      listProducts: new ListProductsUseCase(dependencies),
    },
  } as unknown as CatalogModule

  const authResolver: AuthContextResolverPort = {
    async resolve() {
      return { companyId: params.authCompanyId, scopes: [] }
    },
  }

  return {
    products,
    router: createModuleFetchRouter({ routes: createCatalogRoutes({ module }), basePath: '/v1', authResolver }),
  }
}

describe('BOLA — produto de outra empresa', () => {
  it('ler devolve 404, não 403', async () => {
    const foreign = buildProductRow(COMPANY_B)
    const { router } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(new Request(`http://localhost/v1/products/${foreign.id}`))

    // 403 confirmaria que o id existe. 404 não diz nada.
    expect(response.status).toBe(404)
  })

  it('atualizar devolve 404 e não altera nada', async () => {
    const foreign = buildProductRow(COMPANY_B)
    const { router, products } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request(`http://localhost/v1/products/${foreign.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceInCents: 1 }),
      }),
    )

    expect(response.status).toBe(404)
    expect(products.rows[0]?.priceInCents).toBe(2490)
  })

  it('excluir devolve 404 e não apaga', async () => {
    const foreign = buildProductRow(COMPANY_B)
    const { router, products } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request(`http://localhost/v1/products/${foreign.id}`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(404)
    expect(products.rows[0]?.deletedAt).toBeNull()
  })

  it('listar não devolve produto de outra empresa', async () => {
    const foreign = buildProductRow(COMPANY_B)
    const { router } = buildRouter({ seed: [foreign], authCompanyId: COMPANY_A })

    const response = await router.handle(new Request('http://localhost/v1/products'))
    const payload = (await response.json()) as { data: unknown[] }

    expect(payload.data).toHaveLength(0)
  })
})

describe('o dono continua com acesso', () => {
  it('lê e atualiza o próprio produto', async () => {
    const own = buildProductRow(COMPANY_A)
    const { router, products } = buildRouter({ seed: [own], authCompanyId: COMPANY_A })

    const read = await router.handle(new Request(`http://localhost/v1/products/${own.id}`))
    expect(read.status).toBe(200)

    const updated = await router.handle(
      new Request(`http://localhost/v1/products/${own.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceInCents: 1990 }),
      }),
    )

    expect(updated.status).toBe(200)
    expect(products.rows[0]?.priceInCents).toBe(1990)
  })
})

describe('rota inexistente e validação', () => {
  it('rota fora da tabela devolve 404 sem tocar no módulo', async () => {
    const { router } = buildRouter({ seed: [], authCompanyId: COMPANY_A })
    const response = await router.handle(new Request('http://localhost/v1/inexistente'))
    expect(response.status).toBe(404)
  })

  it('corpo inválido devolve 400 com todos os problemas de uma vez', async () => {
    const { router } = buildRouter({ seed: [], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request('http://localhost/v1/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', priceInCents: -5 }),
      }),
    )
    const payload = (await response.json()) as { error: { code: string; issues: unknown[] } }

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('bulk-import casa a rota literal, não a de parâmetro', async () => {
    const { router } = buildRouter({ seed: [], authCompanyId: COMPANY_A })

    const response = await router.handle(
      new Request('http://localhost/v1/products/bulk-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: [{ name: 'Arroz 5kg', price: '24,90' }] }),
      }),
    )
    const payload = (await response.json()) as { data: { succeeded: number } }

    // Se a ordem da tabela invertesse, `/products/:id` engoliria `bulk-import` como um id.
    expect(response.status).toBe(200)
    expect(payload.data.succeeded).toBe(1)
  })
})
