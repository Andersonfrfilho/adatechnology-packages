/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { createIngredientSchema, saveRecipeSchema, type CreateIngredientInput } from '@adatechnology/recipe-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function setup(params: Parameters<typeof buildTestModule>[0] = {}) {
  const built = buildTestModule(params)
  const { useCases } = built.module
  const createIngredient = (input: CreateIngredientInput, companyId = COMPANY) =>
    useCases.createIngredient.execute({ companyId, input: createIngredientSchema.parse(input) })
  return { ...built, useCases, createIngredient }
}

describe('insumos', () => {
  it('lista por empresa, com busca, filtro de unidade, ordenação e paginação', async () => {
    const { useCases, createIngredient } = setup()
    await createIngredient({ name: 'Farinha', unit: 'kg', costPerUnit: '5', supplier: 'Moinho' })
    await createIngredient({ name: 'Açúcar', unit: 'kg', costPerUnit: '4.2' })
    await createIngredient({ name: 'Leite', unit: 'l', costPerUnit: '4.5' })
    await createIngredient({ name: 'Farinha', unit: 'kg' }, OTHER)

    const byCost = await useCases.listIngredients.execute({
      companyId: COMPANY,
      query: { page: 1, pageSize: 2, sort: 'costPerUnit', order: 'desc', unit: ['kg', 'l'] },
    })
    expect(byCost.data.map((item) => item.name)).toEqual(['Farinha', 'Leite'])
    expect(byCost.pagination).toEqual({ total: 3, page: 1, pageSize: 2, totalPages: 2 })

    const bySupplier = await useCases.listIngredients.execute({
      companyId: COMPANY,
      query: { page: 1, pageSize: 20, sort: 'name', order: 'asc', search: 'moinho' },
    })
    expect(bySupplier.data.map((item) => item.costPerUnit)).toEqual(['5.0000'])
  })

  it('outra empresa não vê nem altera (404)', async () => {
    const { useCases, createIngredient } = setup()
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg' })
    await expect(useCases.getIngredient.execute({ companyId: OTHER, id: flour.id })).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(
      useCases.updateIngredient.execute({ companyId: OTHER, id: flour.id, input: { name: 'X' } }),
    ).rejects.toMatchObject({ code: 'RECIPE_INGREDIENT_NOT_FOUND' })
  })

  it('em uso: não apaga e não troca para unidade incompatível; compatível pode', async () => {
    const { useCases, createIngredient } = setup()
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg' })
    await useCases.saveRecipe.execute({
      companyId: COMPANY,
      productId: 'bread',
      input: saveRecipeSchema.parse({ lines: [{ ingredientId: flour.id, quantity: '500', unit: 'g' }] }),
    })
    await expect(useCases.removeIngredient.execute({ companyId: COMPANY, id: flour.id })).rejects.toMatchObject({
      code: 'RECIPE_INGREDIENT_IN_USE',
      publicDetails: { productIds: ['bread'] },
    })
    await expect(
      useCases.updateIngredient.execute({ companyId: COMPANY, id: flour.id, input: { unit: 'l' } }),
    ).rejects.toMatchObject({ code: 'RECIPE_UNIT_CHANGE_IN_USE' })
    const changed = await useCases.updateIngredient.execute({ companyId: COMPANY, id: flour.id, input: { unit: 'g' } })
    expect(changed.unit).toBe('g')
  })

  it('ganchos recebem o evento; erro no gancho não desfaz a gravação', async () => {
    const events: string[] = []
    const { useCases, createIngredient, state } = setup({
      hooks: {
        onIngredientSaved: (event) => {
          events.push(`${event.isNew ? 'new' : 'upd'}:${event.ingredient.name}`)
          throw new Error('host fora')
        },
      },
    })
    const sugar = await createIngredient({ name: 'Açúcar', unit: 'kg' })
    await useCases.updateIngredient.execute({ companyId: COMPANY, id: sugar.id, input: { name: 'Açúcar cristal' } })
    expect(events).toEqual(['new:Açúcar', 'upd:Açúcar cristal'])
    expect(state.ingredients.get(sugar.id)?.name).toBe('Açúcar cristal')
  })

  it('exporta todos do filtro com teto e cabeçalho', async () => {
    const exported: number[] = []
    const { useCases, createIngredient } = setup({
      hooks: { onExported: (event) => void exported.push(event.rowCount) },
    })
    await createIngredient({ name: '=CMD()', unit: 'un' })
    const file = await useCases.exportIngredients.execute({
      companyId: COMPANY,
      query: { format: 'csv', sort: 'name', order: 'asc' },
    })
    expect(file.fileName).toBe('insumos-2026-03-10.csv')
    expect(String(file.body)).toContain("'=CMD()")
    expect(exported).toEqual([1])
  })
})

describe('fichas técnicas', () => {
  it('grava, mantém id das linhas que já eram da ficha e devolve o custo', async () => {
    const { useCases, createIngredient } = setup()
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg', costPerUnit: '5' })
    const egg = await createIngredient({ name: 'Ovo', unit: 'un', costPerUnit: '0.8' })
    const first = await useCases.saveRecipe.execute({
      companyId: COMPANY,
      productId: 'cake',
      input: saveRecipeSchema.parse({
        yieldPortions: '4',
        preparationTimeMinutes: 45,
        instructions: 'Misturar e assar.',
        lines: [{ ingredientId: flour.id, quantity: '400', unit: 'g' }],
      }),
    })
    const lineId = first.recipe.lines[0]!.id
    const second = await useCases.saveRecipe.execute({
      companyId: COMPANY,
      productId: 'cake',
      salePriceCents: 1200,
      input: saveRecipeSchema.parse({
        yieldPortions: '4',
        lines: [
          { id: lineId, ingredientId: flour.id, quantity: '400', unit: 'g' },
          { id: '99999999-9999-4999-8999-999999999999', ingredientId: egg.id, quantity: '0.5', unit: 'dz' },
        ],
      }),
    })
    expect(second.recipe.id).toBe(first.recipe.id)
    expect(second.recipe.lines[0]!.id).toBe(lineId)
    expect(second.recipe.lines[1]!.id).not.toBe('99999999-9999-4999-8999-999999999999')
    // 0,4 × 5 + 6 × 0,8 = 6,80; por porção 1,70; margem 12,00 − 1,70
    expect(second.cost).toMatchObject({
      totalCostCents: 680,
      costPerPortionCents: 170,
      marginCents: 1030,
      marginBasisPoints: 8583,
    })

    const fetched = await useCases.getRecipe.execute({ companyId: COMPANY, productId: 'cake' })
    expect(fetched.recipe.preparationTimeMinutes).toBeNull()
    await expect(useCases.getRecipe.execute({ companyId: OTHER, productId: 'cake' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('recusa insumo de outra empresa e unidade incompatível, com o índice da linha', async () => {
    const { useCases, createIngredient } = setup()
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg' })
    const foreign = await createIngredient({ name: 'Leite', unit: 'l' }, OTHER)
    await expect(
      useCases.saveRecipe.execute({
        companyId: COMPANY,
        productId: 'p',
        input: saveRecipeSchema.parse({ lines: [{ ingredientId: foreign.id, quantity: '1', unit: 'l' }] }),
      }),
    ).rejects.toMatchObject({ code: 'RECIPE_UNKNOWN_INGREDIENTS', publicDetails: { ingredientIds: [foreign.id] } })
    await expect(
      useCases.saveRecipe.execute({
        companyId: COMPANY,
        productId: 'p',
        input: saveRecipeSchema.parse({ lines: [{ ingredientId: flour.id, quantity: '1', unit: 'ml' }] }),
      }),
    ).rejects.toMatchObject({
      code: 'RECIPE_INCOMPATIBLE_UNIT',
      publicDetails: { issues: [{ index: 0, ingredientUnit: 'kg' }] },
    })
  })

  it('confere o produto no catálogo quando o host liga a porta', async () => {
    const { createRecipeModule } = await import('../RecipeModule')
    const { createInMemoryRecipePersistence } = await import('../testing/inMemoryPersistence')
    const module = createRecipeModule({
      providers: {
        persistence: createInMemoryRecipePersistence(),
        productReference: { findExisting: async ({ productIds }) => productIds.filter((id) => id === 'known') },
      },
    })
    await expect(
      module.useCases.saveRecipe.execute({ companyId: COMPANY, productId: 'ghost', input: saveRecipeSchema.parse({}) }),
    ).rejects.toMatchObject({ code: 'RECIPE_UNKNOWN_PRODUCTS' })
    const saved = await module.useCases.saveRecipe.execute({
      companyId: COMPANY,
      productId: 'known',
      input: saveRecipeSchema.parse({}),
    })
    expect(saved.recipe.productId).toBe('known')
  })

  it('custos em lote e lookup para o estoque', async () => {
    const { useCases, createIngredient } = setup()
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg', costPerUnit: '5' })
    await useCases.saveRecipe.execute({
      companyId: COMPANY,
      productId: 'bread',
      input: saveRecipeSchema.parse({ lines: [{ ingredientId: flour.id, quantity: '1', unit: 'kg' }] }),
    })
    const costs = await useCases.calculateRecipeCosts.execute({
      companyId: COMPANY,
      products: [
        { productId: 'bread', salePriceCents: 1000 },
        { productId: 'none', salePriceCents: 500 },
      ],
    })
    expect(costs.costs.map((cost) => [cost.productId, cost.marginBasisPoints])).toEqual([['bread', 5000]])
    expect(costs.productsWithoutRecipe).toEqual(['none'])
    const lookup = await useCases.lookupRecipes.execute({ companyId: COMPANY, productIds: ['bread', 'bread'] })
    expect(lookup.recipes).toHaveLength(1)
    expect(lookup.ingredients.map((item) => item.unit)).toEqual(['kg'])
  })
})

describe('lista de compras', () => {
  it('sem porta de estoque: bruto; com porta: desconta, e exporta', async () => {
    const levels: string[][] = []
    const withStock = setup({
      stockLevels: {
        getLevels: async ({ ingredientIds }) => {
          levels.push([...ingredientIds])
          return ingredientIds.map((ingredientId) => ({ ingredientId, quantity: '0.5' }))
        },
      },
    })
    const plain = setup()
    for (const env of [withStock, plain]) {
      const flour = await env.createIngredient({ name: 'Farinha', unit: 'kg', costPerUnit: '5' })
      await env.useCases.saveRecipe.execute({
        companyId: COMPANY,
        productId: 'bread',
        input: saveRecipeSchema.parse({
          yieldPortions: '2',
          lines: [{ ingredientId: flour.id, quantity: '1', unit: 'kg' }],
        }),
      })
    }
    const items = [
      { productId: 'bread', quantity: '3.0000' },
      { productId: 'cake', quantity: '1.0000' },
    ]
    const gross = await plain.useCases.buildShoppingList.execute({ companyId: COMPANY, items })
    expect(gross.rows.map((row) => [row.netQuantity, row.stockQuantity])).toEqual([['1.5000', null]])
    expect(gross.productsWithoutRecipe).toEqual(['cake'])

    const net = await withStock.useCases.buildShoppingList.execute({ companyId: COMPANY, items })
    expect(net.rows.map((row) => [row.netQuantity, row.estimatedCostCents])).toEqual([['1.0000', 500]])
    expect(levels).toHaveLength(1)

    const file = await withStock.useCases.exportShoppingList.execute({ companyId: COMPANY, items, format: 'xlsx' })
    expect(file.fileName).toBe('lista-de-compras-2026-03-10.xlsx')
    expect(file.body).toBeInstanceOf(Uint8Array)
  })
})
