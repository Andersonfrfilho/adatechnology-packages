/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que a tela de catálogo precisa da listagem: o nome do catálogo em cada produto e a contagem
 * de produtos em cada catálogo.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { createInMemoryCatalogs, createInMemoryProducts, createInMemorySections } from '../testing/inMemoryRepositories'
import type { CatalogDependencies } from './catalogModule.types'
import { CreateCatalogUseCase, GetCatalogUseCase, ListCatalogsUseCase } from './Catalog.use-cases'
import { CreateProductUseCase, ListProductsUseCase } from './Product.use-cases'

const COMPANY_ID = randomUUID()

function build() {
  const products = createInMemoryProducts()
  const dependencies = {
    products,
    catalogs: createInMemoryCatalogs([], products),
    sections: createInMemorySections(),
    config: { currency: 'BRL', locale: 'pt-BR' },
  } as unknown as CatalogDependencies
  return dependencies
}

describe('listagem para a tela de catálogo', () => {
  it('produto traz catalogName; sem catálogo, o campo fica ausente', async () => {
    const dependencies = build()
    const drinks = await new CreateCatalogUseCase(dependencies).execute({ companyId: COMPANY_ID, name: 'Bebidas' })
    const create = new CreateProductUseCase(dependencies)
    await create.execute({ companyId: COMPANY_ID, name: 'Suco', priceInCents: 900, catalogId: drinks.id })
    await create.execute({ companyId: COMPANY_ID, name: 'Avulso', priceInCents: 100 })

    const page = await new ListProductsUseCase(dependencies).execute({ companyId: COMPANY_ID, page: 1, pageSize: 20 })

    expect(page.data.find((product) => product.name === 'Suco')?.catalogName).toBe('Bebidas')
    expect(page.data.find((product) => product.name === 'Avulso')?.catalogName).toBeUndefined()
  })

  it('catálogo traz a contagem de produtos vivos', async () => {
    const dependencies = build()
    const drinks = await new CreateCatalogUseCase(dependencies).execute({ companyId: COMPANY_ID, name: 'Bebidas' })
    const create = new CreateProductUseCase(dependencies)
    await create.execute({ companyId: COMPANY_ID, name: 'Suco', priceInCents: 900, catalogId: drinks.id })
    await create.execute({ companyId: COMPANY_ID, name: 'Água', priceInCents: 300, catalogId: drinks.id })

    const page = await new ListCatalogsUseCase(dependencies).execute({ companyId: COMPANY_ID, page: 1, pageSize: 20 })

    expect(page.data[0]?.productCount).toBe(2)
  })

  it('detalhe do catálogo traz a contagem; id de outra empresa é 404', async () => {
    const dependencies = build()
    const drinks = await new CreateCatalogUseCase(dependencies).execute({ companyId: COMPANY_ID, name: 'Bebidas' })
    await new CreateProductUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      name: 'Suco',
      priceInCents: 900,
      catalogId: drinks.id,
    })
    const get = new GetCatalogUseCase(dependencies)

    expect((await get.execute({ companyId: COMPANY_ID, id: drinks.id })).productCount).toBe(1)
    await expect(get.execute({ companyId: randomUUID(), id: drinks.id })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('listagem com filtros múltiplos e ordenação', () => {
  async function seed() {
    const dependencies = build()
    const catalogCreate = new CreateCatalogUseCase(dependencies)
    const drinks = await catalogCreate.execute({ companyId: COMPANY_ID, name: 'Bebidas' })
    const food = await catalogCreate.execute({ companyId: COMPANY_ID, name: 'Pratos' })
    const create = new CreateProductUseCase(dependencies)
    await create.execute({ companyId: COMPANY_ID, name: 'Suco', priceInCents: 900, catalogId: drinks.id })
    await create.execute({ companyId: COMPANY_ID, name: 'Feijoada', priceInCents: 4500, catalogId: food.id })
    await create.execute({ companyId: COMPANY_ID, name: 'Pacote festa', priceInCents: null, catalogId: food.id })
    await create.execute({ companyId: COMPANY_ID, name: 'Avulso', priceInCents: 100 })
    return { dependencies, drinks, food }
  }

  const list = (dependencies: CatalogDependencies, extra: Record<string, unknown>) =>
    new ListProductsUseCase(dependencies).execute({ companyId: COMPANY_ID, page: 1, pageSize: 20, ...extra })

  it('catalogIds aceita vários e o valor reservado "none" casa produto sem catálogo', async () => {
    const { dependencies, drinks, food } = await seed()

    const both = await list(dependencies, { catalogIds: [drinks.id, food.id] })
    expect(both.total).toBe(3)

    const noneAndDrinks = await list(dependencies, { catalogIds: ['none', drinks.id] })
    expect(noneAndDrinks.data.map((product) => product.name).sort()).toEqual(['Avulso', 'Suco'])
  })

  it('priceOnRequest filtra os sem preço; ordenar por preço manda "sob consulta" para o fim nos dois sentidos', async () => {
    const { dependencies } = await seed()

    const onRequest = await list(dependencies, { priceOnRequest: true })
    expect(onRequest.data.map((product) => product.name)).toEqual(['Pacote festa'])

    const ascending = await list(dependencies, { sortBy: 'price', sortDirection: 'asc' })
    const descending = await list(dependencies, { sortBy: 'price', sortDirection: 'desc' })
    expect(ascending.data.map((product) => product.name)).toEqual(['Avulso', 'Suco', 'Feijoada', 'Pacote festa'])
    expect(descending.data.map((product) => product.name)).toEqual(['Feijoada', 'Suco', 'Avulso', 'Pacote festa'])
  })

  it('ordena por nome nos dois sentidos', async () => {
    const { dependencies } = await seed()

    const descending = await list(dependencies, { sortBy: 'name', sortDirection: 'desc' })
    expect(descending.data[0]?.name).toBe('Suco')
  })
})
