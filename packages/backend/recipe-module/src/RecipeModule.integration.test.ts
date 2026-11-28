/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres: migrations no schema `recipes` (duas vezes, idempotente), numeric
 * exato, FK composta por empresa, troca de linhas em transação e paginação. Sem
 * `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte é pulada — mesmo padrão dos outros módulos.
 * Cada execução usa empresas novas (UUID aleatório), então não depende de banco limpo.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { createIngredientSchema, saveRecipeSchema } from '@adatechnology/recipe-contracts'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { RecipeDatabase } from './database.types'
import { createRecipeModule, type RecipeModule } from './RecipeModule'
import { runRecipeMigrations } from './runMigrations'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('recipe-module (integração Postgres real)', () => {
  let sql: SQL
  let module: RecipeModule
  const companyId = crypto.randomUUID()
  const otherCompanyId = crypto.randomUUID()

  const createIngredient = (input: Record<string, unknown>, company = companyId) =>
    module.useCases.createIngredient.execute({ companyId: company, input: createIngredientSchema.parse(input) })

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    const db = drizzle({ client: sql }) as unknown as RecipeDatabase
    const run = () => runRecipeMigrations({ db, migrate: async (target, config) => migrate(target as never, config) })
    await run()
    await run()
    module = createRecipeModule({ db })
  })

  afterAll(async () => {
    await sql.close()
  })

  test('custo exato com numeric(14,4) e conversão de unidade', async () => {
    const butter = await createIngredient({ name: 'Manteiga', unit: 'kg', costPerUnit: '0.1' })
    const cream = await createIngredient({ name: 'Creme', unit: 'l', costPerUnit: '0.2' })
    const saved = await module.useCases.saveRecipe.execute({
      companyId,
      productId: 'integration-cake',
      salePriceCents: 100,
      input: saveRecipeSchema.parse({
        yieldPortions: '3',
        preparationTimeMinutes: 30,
        lines: [
          { ingredientId: butter.id, quantity: '1000', unit: 'g' },
          { ingredientId: cream.id, quantity: '1', unit: 'l' },
        ],
      }),
    })
    expect(saved.cost.totalCost).toBe('0.3000')
    expect(saved.cost.costPerPortion).toBe('0.1000')
    expect(saved.cost.marginBasisPoints).toBe(9000)
    const [row] = await sql`SELECT cost_per_unit FROM recipes.ingredients WHERE id = ${butter.id}`
    expect(row.cost_per_unit).toBe('0.1000')
  })

  test('troca de linhas mantém ids, e o banco recusa insumo de outra empresa', async () => {
    const flour = await createIngredient({ name: 'Farinha', unit: 'kg', costPerUnit: '5' })
    const first = await module.useCases.saveRecipe.execute({
      companyId,
      productId: 'integration-bread',
      input: saveRecipeSchema.parse({ lines: [{ ingredientId: flour.id, quantity: '1', unit: 'kg' }] }),
    })
    const lineId = first.recipe.lines[0]!.id
    const second = await module.useCases.saveRecipe.execute({
      companyId,
      productId: 'integration-bread',
      input: saveRecipeSchema.parse({ lines: [{ id: lineId, ingredientId: flour.id, quantity: '2', unit: 'kg' }] }),
    })
    expect(second.recipe.lines.map((line) => [line.id, line.quantity])).toEqual([[lineId, '2.0000']])

    const foreign = await createIngredient({ name: 'Farinha', unit: 'kg' }, otherCompanyId)
    // A consulta do Bun SQL só roda quando aguardada: embrulhada para o `rejects` aguardar de fato.
    const insertForeign = async () => {
      await sql`INSERT INTO recipes.recipe_lines (company_id, recipe_id, ingredient_id, quantity, unit)
          VALUES (${companyId}, ${first.recipe.id}, ${foreign.id}, 1, 'kg')`
    }
    await expect(insertForeign()).rejects.toThrow('recipe_lines_ingredient_fk')
    await expect(module.useCases.removeIngredient.execute({ companyId, id: flour.id })).rejects.toMatchObject({
      code: 'RECIPE_INGREDIENT_IN_USE',
    })
  })

  test('lista paginada, busca com curinga literal, lote de custos e lista de compras', async () => {
    await createIngredient({ name: '100%_cacau', unit: 'g' })
    const page = await module.useCases.listIngredients.execute({
      companyId,
      query: { page: 1, pageSize: 2, sort: 'name', order: 'asc', search: '%_' },
    })
    expect(page.data.map((item) => item.name)).toEqual(['100%_cacau'])
    const all = await module.useCases.listIngredients.execute({
      companyId,
      query: { page: 2, pageSize: 2, sort: 'name', order: 'asc' },
    })
    expect(all.pagination.total).toBe(4)
    const costs = await module.useCases.calculateRecipeCosts.execute({
      companyId,
      products: [{ productId: 'integration-bread', salePriceCents: 2000 }, { productId: 'integration-cake' }],
    })
    expect(costs.costs.map((cost) => cost.totalCostCents)).toEqual([1000, 30])
    const list = await module.useCases.buildShoppingList.execute({
      companyId,
      items: [{ productId: 'integration-bread', quantity: '3.0000' }],
    })
    expect(list.rows.map((row) => row.netQuantity)).toEqual(['6.0000'])
  })
})
