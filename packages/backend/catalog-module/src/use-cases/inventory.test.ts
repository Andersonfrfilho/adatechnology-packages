/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estoque — inclui o **teste de concorrência** que a T2.3 exige.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { InsufficientInventoryError } from '@adatechnology/catalog-contracts'

import { AdjustInventoryUseCase, ConsumeInventoryUseCase } from './Inventory.use-cases'
import { createInMemoryCatalogs, createInMemoryProducts, createInMemorySections } from '../testing/inMemoryRepositories'
import type { CatalogDependencies } from './catalogModule.types'
import type { ProductRow } from '../schema/schema'

const COMPANY_ID = randomUUID()

function buildProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: randomUUID(),
    companyId: COMPANY_ID,
    catalogId: null,
    sectionId: null,
    name: 'Leite integral 1L',
    description: null,
    priceInCents: 599,
    costPriceInCents: 420,
    unit: 'un',
    barcode: null,
    imageUrl: null,
    imageStorageKey: null,
    inventory: 1,
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
    ...overrides,
  } as ProductRow
}

function buildDependencies(options: { product: ProductRow; deriveAvailability?: boolean; onOutOfStock?: () => void }) {
  const products = createInMemoryProducts([options.product])
  const outOfStockCalls: string[] = []

  const dependencies = {
    products,
    catalogs: createInMemoryCatalogs(),
    sections: createInMemorySections(),
    config: {
      currency: 'BRL',
      locale: 'pt-BR',
      deriveAvailabilityFromInventory: options.deriveAvailability ?? true,
    },
    hooks: {
      onProductOutOfStock: (event: { productId: string }) => {
        outOfStockCalls.push(event.productId)
        options.onOutOfStock?.()
      },
    },
  } as unknown as CatalogDependencies

  return { dependencies, products, outOfStockCalls }
}

describe('ConsumeInventory — concorrência (T2.3)', () => {
  it('dois consumos simultâneos do ÚLTIMO item: um passa, o outro falha', async () => {
    const product = buildProduct({ inventory: 1 })
    const { dependencies, products } = buildDependencies({ product })
    const useCase = new ConsumeInventoryUseCase(dependencies)

    // Disparados juntos, sem await entre eles — é a corrida real de dois pedidos fechando ao
    // mesmo tempo. `allSettled` porque um DEVE rejeitar.
    const results = await Promise.allSettled([
      useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 1 }),
      useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 1 }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientInventoryError)
    // O que importa de verdade: o estoque não ficou negativo.
    expect(products.rows[0]?.inventory).toBe(0)
  })

  it('dez consumos concorrentes com estoque 3: exatamente 3 passam', async () => {
    const product = buildProduct({ inventory: 3 })
    const { dependencies, products } = buildDependencies({ product })
    const useCase = new ConsumeInventoryUseCase(dependencies)

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 1 })),
    )

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    expect(products.rows[0]?.inventory).toBe(0)
  })

  it('recusa quantidade maior que o saldo sem tocar no estoque', async () => {
    const product = buildProduct({ inventory: 2 })
    const { dependencies, products } = buildDependencies({ product })
    const useCase = new ConsumeInventoryUseCase(dependencies)

    await expect(useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 5 })).rejects.toBeInstanceOf(
      InsufficientInventoryError,
    )
    expect(products.rows[0]?.inventory).toBe(2)
  })
})

describe('ConsumeInventory — estoque não controlado', () => {
  it('produto com inventory null nunca bloqueia venda', async () => {
    const product = buildProduct({ inventory: null })
    const { dependencies, outOfStockCalls } = buildDependencies({ product })
    const useCase = new ConsumeInventoryUseCase(dependencies)

    await useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 999 })

    // Quem não controla estoque não fica sem — e não dispara alerta de reposição.
    expect(outOfStockCalls).toHaveLength(0)
  })
})

describe('evento de esgotado dispara na transição, não a cada venda', () => {
  it('avisa uma vez quando o consumo zera o estoque', async () => {
    const product = buildProduct({ inventory: 2 })
    const { dependencies, outOfStockCalls } = buildDependencies({ product })
    const useCase = new ConsumeInventoryUseCase(dependencies)

    await useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 1 })
    expect(outOfStockCalls).toHaveLength(0) // ainda tem 1

    await useCase.execute({ companyId: COMPANY_ID, productId: product.id, quantity: 1 })
    expect(outOfStockCalls).toEqual([product.id])
  })

  it('derruba a disponibilidade junto quando a derivação está ligada', async () => {
    const product = buildProduct({ inventory: 1 })
    const { dependencies, products } = buildDependencies({ product, deriveAvailability: true })

    await new ConsumeInventoryUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      productId: product.id,
      quantity: 1,
    })

    expect(products.rows[0]?.availability).toBe('out of stock')
  })

  it('não mexe na disponibilidade quando a derivação está desligada', async () => {
    const product = buildProduct({ inventory: 1 })
    const { dependencies, products } = buildDependencies({ product, deriveAvailability: false })

    await new ConsumeInventoryUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      productId: product.id,
      quantity: 1,
    })

    // Quem vende sob encomenda não some do catálogo por estar zerado.
    expect(products.rows[0]?.availability).toBe('in stock')
  })
})

describe('AdjustInventory', () => {
  it('é absoluto, não incremental — contagem de prateleira produz "tenho 12"', async () => {
    const product = buildProduct({ inventory: 5 })
    const { dependencies, products } = buildDependencies({ product })

    await new AdjustInventoryUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      productId: product.id,
      inventory: 12,
    })

    expect(products.rows[0]?.inventory).toBe(12)
  })

  it('zerar por ajuste manual também avisa o esgotado', async () => {
    const product = buildProduct({ inventory: 4 })
    const { dependencies, outOfStockCalls } = buildDependencies({ product })

    await new AdjustInventoryUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      productId: product.id,
      inventory: 0,
    })

    expect(outOfStockCalls).toEqual([product.id])
  })
})
