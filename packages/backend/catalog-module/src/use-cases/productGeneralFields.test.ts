/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Preço sob consulta, agenda de disponibilidade e `attributes`.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { MetaCatalogSyncPort } from '@adatechnology/catalog-contracts'

import { createInMemoryCatalogs, createInMemoryProducts, createInMemorySections } from '../testing/inMemoryRepositories'
import type { CatalogDependencies } from './catalogModule.types'
import { SyncProductToMetaUseCase } from './MetaSync.use-cases'
import {
  CreateProductUseCase,
  IsProductAvailableUseCase,
  ListAvailableProductsUseCase,
  UpdateProductUseCase,
} from './Product.use-cases'

const COMPANY_ID = randomUUID()
// 2026-11-25 é quarta; 15:00Z = 12:00 em São Paulo.
const WEDNESDAY_NOON_SAO_PAULO = new Date('2026-11-25T15:00:00Z')

function build(overrides: Partial<CatalogDependencies> = {}) {
  const products = createInMemoryProducts()
  const dependencies = {
    products,
    catalogs: createInMemoryCatalogs(),
    sections: createInMemorySections(),
    config: {
      currency: 'BRL',
      locale: 'pt-BR',
      defaultTimeZone: 'America/Sao_Paulo',
      metaSync: { products: true, catalogs: false },
    },
    ...overrides,
  } as unknown as CatalogDependencies
  return { dependencies, products }
}

describe('preço sob consulta', () => {
  it('cria produto com priceInCents null e devolve null (zero continua sendo preço)', async () => {
    const { dependencies } = build()
    const create = new CreateProductUseCase(dependencies)

    const onRequest = await create.execute({ companyId: COMPANY_ID, name: 'Festa', priceInCents: null })
    const free = await create.execute({ companyId: COMPANY_ID, name: 'Brinde', priceInCents: 0 })

    expect(onRequest.priceInCents).toBeNull()
    expect(free.priceInCents).toBe(0)
  })

  it('update pode limpar e definir o preço', async () => {
    const { dependencies } = build()
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'X',
      priceInCents: 500,
    })
    const update = new UpdateProductUseCase(dependencies)

    expect(
      (await update.execute({ companyId: COMPANY_ID, id: created.id, priceInCents: null })).priceInCents,
    ).toBeNull()
    expect((await update.execute({ companyId: COMPANY_ID, id: created.id, priceInCents: 900 })).priceInCents).toBe(900)
  })

  it('não publica na Meta: falha permanente, sem chamar o provedor', async () => {
    let calls = 0
    const metaSync = {
      async upsertProduct() {
        calls += 1
        return { outcome: 'synced', externalId: 'x' }
      },
    } as unknown as MetaCatalogSyncPort
    const { dependencies } = build({ metaSync })
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'Festa',
      priceInCents: null,
    })

    const outcome = await new SyncProductToMetaUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      productId: created.id,
    })

    expect(outcome.outcome).toBe('permanent')
    expect(calls).toBe(0)
  })
})

describe('agenda de disponibilidade', () => {
  async function seed() {
    const { dependencies } = build()
    const create = new CreateProductUseCase(dependencies)
    const lunch = await create.execute({
      companyId: COMPANY_ID,
      name: 'Prato do dia',
      priceInCents: 3000,
      availabilitySchedule: { weekdays: [3], from: '11:00', until: '15:00' },
    })
    const always = await create.execute({ companyId: COMPANY_ID, name: 'Água', priceInCents: 500 })
    const friday = await create.execute({
      companyId: COMPANY_ID,
      name: 'Feijoada',
      priceInCents: 4000,
      availabilitySchedule: { weekdays: [5] },
    })
    const paused = await create.execute({ companyId: COMPANY_ID, name: 'Pausado', priceInCents: 100 })
    await new UpdateProductUseCase(dependencies).execute({ companyId: COMPANY_ID, id: paused.id, active: false })
    return { dependencies, lunch, always, friday, paused }
  }

  it('lista só o que é vendável no instante, no fuso padrão do módulo', async () => {
    const { dependencies } = await seed()
    const list = await new ListAvailableProductsUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      at: WEDNESDAY_NOON_SAO_PAULO,
    })
    expect(list.map((product) => product.name).sort()).toEqual(['Prato do dia', 'Água'])

    // 18:00 em São Paulo: fora da janela do almoço.
    const evening = await new ListAvailableProductsUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      at: new Date('2026-11-25T21:00:00Z'),
    })
    expect(evening.map((product) => product.name)).toEqual(['Água'])
  })

  it('isProductAvailable explica o motivo', async () => {
    const { dependencies, lunch, friday, paused } = await seed()
    const check = new IsProductAvailableUseCase(dependencies)
    const at = WEDNESDAY_NOON_SAO_PAULO

    expect(await check.execute({ companyId: COMPANY_ID, id: lunch.id, at })).toEqual({ available: true })
    expect(await check.execute({ companyId: COMPANY_ID, id: friday.id, at })).toEqual({
      available: false,
      reason: 'outside_schedule',
    })
    expect(await check.execute({ companyId: COMPANY_ID, id: paused.id, at })).toEqual({
      available: false,
      reason: 'inactive',
    })
  })

  it('esgotado/pausado (`availability`) vence a agenda', async () => {
    const { dependencies, products } = build()
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'X',
      priceInCents: 1,
    })
    await products.update({ companyId: COMPANY_ID, id: created.id, values: { availability: 'out of stock' } })

    const verdict = await new IsProductAvailableUseCase(dependencies).execute({ companyId: COMPANY_ID, id: created.id })
    expect(verdict).toEqual({ available: false, reason: 'out_of_stock' })
  })

  it('update com availabilitySchedule null remove a restrição', async () => {
    const { dependencies } = build()
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'X',
      priceInCents: 1,
      availabilitySchedule: { weekdays: [5] },
    })
    const updated = await new UpdateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: created.id,
      availabilitySchedule: null,
    })
    expect(updated.availabilitySchedule).toBeNull()
  })
})

describe('attributes', () => {
  it('persiste e substitui o objeto; padrão é {}', async () => {
    const { dependencies } = build()
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'Quarto',
      priceInCents: null,
      attributes: { capacity: 4, includes: ['café'] },
    })
    expect(created.attributes).toEqual({ capacity: 4, includes: ['café'] })

    const replaced = await new UpdateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: created.id,
      attributes: { capacity: 2 },
    })
    expect(replaced.attributes).toEqual({ capacity: 2 })

    const plain = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'Y',
      priceInCents: 1,
    })
    expect(plain.attributes).toEqual({})
  })

  it('o validador do host pode recusar, e o erro dele propaga como está', async () => {
    class HostError extends Error {}
    const attributesValidator = {
      validate({ attributes }: { attributes: Record<string, unknown> }) {
        if (typeof attributes.capacity !== 'number') throw new HostError('capacity must be a number')
      },
    }
    const { dependencies, products } = build({ attributesValidator })
    const create = new CreateProductUseCase(dependencies)

    await expect(
      create.execute({ companyId: COMPANY_ID, name: 'Q', priceInCents: 1, attributes: { capacity: 'x' } }),
    ).rejects.toBeInstanceOf(HostError)
    expect(products.rows).toHaveLength(0)
    await expect(
      create.execute({ companyId: COMPANY_ID, name: 'Q', priceInCents: 1, attributes: { capacity: 3 } }),
    ).resolves.toBeDefined()
  })
})

describe('attributes.orderEligibility', () => {
  it('é guardado em attributes, devolvido na leitura e substituído no update', async () => {
    const { dependencies } = build()
    const created = await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'Item restrito',
      priceInCents: 1000,
      attributes: { orderEligibility: { minimumAge: 18, audience: 'staying_guests' } },
    })

    expect(created.attributes?.orderEligibility).toEqual({ minimumAge: 18, audience: 'staying_guests' })

    const updated = await new UpdateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: created.id,
      attributes: { orderEligibility: { minimumAge: null } },
    })

    expect(updated.attributes?.orderEligibility).toEqual({ minimumAge: null })
  })
})
