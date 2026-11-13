/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { MetaSyncDisabledError } from '@adatechnology/catalog-contracts'
import type { MetaCatalogSyncPort, MetaSyncOutcome } from '@adatechnology/catalog-contracts'

import {
  RecordMetaReviewVerdictUseCase,
  RetryFailedSyncsUseCase,
  SyncPendingToMetaUseCase,
  SyncProductToMetaUseCase,
} from './MetaSync.use-cases'
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
    name: 'Vinho tinto 750ml',
    description: null,
    priceInCents: 8990,
    costPriceInCents: 5200,
    unit: 'un',
    barcode: null,
    imageUrl: null,
    imageStorageKey: null,
    inventory: 5,
    active: true,
    sortOrder: 0,
    availability: 'in stock',
    preparationTimeMinutes: null,
    preparationInstructions: null,
    externalId: null,
    syncStatus: 'pending',
    syncError: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductRow
}

function buildDependencies(options: { seed: ProductRow[]; outcome?: MetaSyncOutcome; metaSyncOn?: boolean }) {
  const products = createInMemoryProducts(options.seed)
  const sent: string[] = []

  const metaSync: MetaCatalogSyncPort = {
    async upsertProduct(payload) {
      sent.push(payload.retailerId)
      return options.outcome ?? { outcome: 'synced', externalId: `meta-${payload.retailerId}` }
    },
    async deleteProduct() {},
    async upsertProductSet() {
      return { outcome: 'synced', externalId: 'set-1' }
    },
    async deleteProductSet() {},
  }

  const dependencies = {
    products,
    catalogs: createInMemoryCatalogs(),
    sections: createInMemorySections(),
    config: {
      currency: 'BRL',
      locale: 'pt-BR',
      metaSync: { products: options.metaSyncOn ?? true, catalogs: false },
    },
    metaSync: options.metaSyncOn === false ? undefined : metaSync,
  } as unknown as CatalogDependencies

  return { dependencies, products, sent }
}

describe('SyncProductToMeta — reage ao discriminante do outcome', () => {
  it('synced grava externalId e limpa o erro', async () => {
    const product = buildProduct()
    const { dependencies, products } = buildDependencies({ seed: [product] })

    await new SyncProductToMetaUseCase(dependencies).execute({ companyId: COMPANY_ID, productId: product.id })

    expect(products.rows[0]?.syncStatus).toBe('synced')
    expect(products.rows[0]?.externalId).toBe(`meta-${product.id}`)
    expect(products.rows[0]?.syncError).toBeNull()
  })

  it('retriable VOLTA para pending — a próxima varredura tenta de novo sozinha', async () => {
    const product = buildProduct()
    const { dependencies, products } = buildDependencies({
      seed: [product],
      outcome: { outcome: 'retriable', errorCode: 'rate_limited', message: 'Too many calls' },
    })

    await new SyncProductToMetaUseCase(dependencies).execute({ companyId: COMPANY_ID, productId: product.id })

    // Sem fila e sem backoff explícito: o intervalo do cron é o backoff.
    expect(products.rows[0]?.syncStatus).toBe('pending')
    expect(products.rows[0]?.syncError).toBe('Too many calls')
  })

  it('permanent vira failed com o motivo visível para o operador corrigir', async () => {
    const product = buildProduct()
    const { dependencies, products } = buildDependencies({
      seed: [product],
      outcome: { outcome: 'permanent', errorCode: 'invalid_image', message: 'Imagem fora do padrão' },
    })

    await new SyncProductToMetaUseCase(dependencies).execute({ companyId: COMPANY_ID, productId: product.id })

    expect(products.rows[0]?.syncStatus).toBe('failed')
    expect(products.rows[0]?.syncError).toBe('Imagem fora do padrão')
  })

  it('recusa quando metaSync está desligado, em vez de publicar às escondidas', async () => {
    const product = buildProduct()
    const { dependencies } = buildDependencies({ seed: [product], metaSyncOn: false })

    await expect(
      new SyncProductToMetaUseCase(dependencies).execute({ companyId: COMPANY_ID, productId: product.id }),
    ).rejects.toBeInstanceOf(MetaSyncDisabledError)
  })
})

describe('SyncPendingToMeta — a varredura do cron', () => {
  it('publica todos os pendentes e relata o resultado', async () => {
    const pending = [buildProduct(), buildProduct(), buildProduct()]
    const { dependencies, sent } = buildDependencies({ seed: pending })
    const syncProduct = new SyncProductToMetaUseCase(dependencies)

    const result = await new SyncPendingToMetaUseCase(dependencies, syncProduct).execute({ companyId: COMPANY_ID })

    expect(result).toEqual({ processed: 3, synced: 3, failed: 0 })
    expect(sent).toHaveLength(3)
  })

  it('não faz nada quando metaSync está desligado — nem consulta o banco', async () => {
    const { dependencies, sent } = buildDependencies({ seed: [buildProduct()], metaSyncOn: false })
    const syncProduct = new SyncProductToMetaUseCase(dependencies)

    const result = await new SyncPendingToMetaUseCase(dependencies, syncProduct).execute({ companyId: COMPANY_ID })

    expect(result).toEqual({ processed: 0, synced: 0, failed: 0 })
    expect(sent).toHaveLength(0)
  })

  it('um item que falha não derruba a varredura', async () => {
    const pending = [buildProduct(), buildProduct()]
    const { dependencies } = buildDependencies({
      seed: pending,
      outcome: { outcome: 'permanent', errorCode: 'x', message: 'erro' },
    })
    const syncProduct = new SyncProductToMetaUseCase(dependencies)

    const result = await new SyncPendingToMetaUseCase(dependencies, syncProduct).execute({ companyId: COMPANY_ID })

    expect(result.processed).toBe(2)
    expect(result.failed).toBe(2)
  })
})

describe('RetryFailedSyncs', () => {
  it('devolve os failed para pending, para a varredura seguinte pegá-los', async () => {
    const failed = [buildProduct({ syncStatus: 'failed', syncError: 'erro antigo' })]
    const { dependencies, products } = buildDependencies({ seed: failed })

    const result = await new RetryFailedSyncsUseCase(dependencies).execute({ companyId: COMPANY_ID })

    expect(result.requeued).toBe(1)
    expect(products.rows[0]?.syncStatus).toBe('pending')
    // Limpa o erro antigo: mantê-lo confundiria com uma falha nova na próxima tentativa.
    expect(products.rows[0]?.syncError).toBeNull()
  })
})

describe('RecordMetaReviewVerdict — o veredito chega depois, pelo webhook', () => {
  it('aprovacao grava o externalId da Meta e limpa o erro anterior', async () => {
    const product = buildProduct({ syncStatus: 'failed', syncError: 'Em revisao' })
    const { dependencies, products } = buildDependencies({ seed: [product] })

    const result = await new RecordMetaReviewVerdictUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      retailerId: product.id,
      approved: true,
      externalId: 'meta-item-9',
    })

    expect(result.applied).toBe(true)
    expect(products.rows[0]?.syncStatus).toBe('synced')
    expect(products.rows[0]?.externalId).toBe('meta-item-9')
    expect(products.rows[0]?.syncError).toBeNull()
  })

  it('reprovacao NAO volta para pending — reenviar o mesmo item seria reprovado de novo', async () => {
    const product = buildProduct({ syncStatus: 'synced', externalId: 'meta-item-9' })
    const { dependencies, products } = buildDependencies({ seed: [product] })

    await new RecordMetaReviewVerdictUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      retailerId: product.id,
      approved: false,
      reason: 'Imagem fora do padrao',
    })

    expect(products.rows[0]?.syncStatus).toBe('failed')
    expect(products.rows[0]?.syncError).toBe('Imagem fora do padrao')
  })

  it('o veredito nao chama a Graph API — republicar aqui viraria eco sem fim', async () => {
    const product = buildProduct()
    const { dependencies, sent } = buildDependencies({ seed: [product] })

    await new RecordMetaReviewVerdictUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      retailerId: product.id,
      approved: true,
    })

    expect(sent).toEqual([])
  })

  it('item de outra origem no mesmo catalogo e descartado, e nao erro', async () => {
    const { dependencies, products } = buildDependencies({ seed: [buildProduct()] })

    const result = await new RecordMetaReviewVerdictUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      retailerId: randomUUID(),
      approved: false,
    })

    expect(result.applied).toBe(false)
    expect(products.rows[0]?.syncStatus).toBe('pending')
  })
})
