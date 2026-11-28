/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres: migrations no schema `stock` (duas vezes), travas de nível e lote
 * sob concorrência, baixa idempotente pela PK de `deductions`, FEFO, um inventário aberto pelo índice
 * parcial e a varredura de validade. Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte é
 * pulada. Cada execução usa uma empresa nova (UUID aleatório).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import type { Recipe } from '@adatechnology/recipe-contracts'
import { receiveBatchSchema, type StockIngredient } from '@adatechnology/stock-contracts'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { StockDatabase } from './database.types'
import { runStockMigrations } from './runMigrations'
import { createStockModule, type StockModule } from './StockModule'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('stock-module (integração Postgres real)', () => {
  let sql: SQL
  let module: StockModule
  const companyId = crypto.randomUUID()
  const flour: StockIngredient = { id: crypto.randomUUID(), name: 'Farinha', unit: 'kg' }
  const bread: Recipe = {
    id: crypto.randomUUID(),
    companyId,
    productId: 'integration-bread',
    yieldPortions: '1.0000',
    preparationTimeMinutes: null,
    instructions: '',
    lines: [
      { id: crypto.randomUUID(), ingredientId: flour.id, quantity: '100.0000', unit: 'g', notes: null, position: 0 },
    ],
    createdAt: '',
    updatedAt: '',
  }

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    const db = drizzle({ client: sql }) as unknown as StockDatabase
    const run = () => runStockMigrations({ db, migrate: async (target, config) => migrate(target as never, config) })
    await run()
    await run()
    const owned = (requested: string, ids: readonly string[]) =>
      requested === companyId && ids.includes(flour.id) ? [flour] : []
    module = createStockModule({
      db,
      providers: {
        catalog: {
          findIngredients: async ({ companyId: requested, ingredientIds }) => owned(requested, ingredientIds),
        },
        recipes: {
          lookup: async ({ companyId: requested }) => ({
            recipes: requested === companyId ? [bread] : [],
            ingredients: owned(requested, [flour.id]),
          }),
        },
      },
    })
  })

  afterAll(async () => {
    await sql.close()
  })

  const receive = (input: Record<string, unknown>) =>
    module.useCases.receiveBatch.execute({
      companyId,
      input: receiveBatchSchema.parse({ ingredientId: flour.id, ...input }),
    })

  test('FEFO e baixas concorrentes: a mesma linha baixa uma vez, linhas diferentes somam', async () => {
    await receive({ quantity: '1', batchCode: 'late', expiresAt: '2099-02-01T00:00:00Z' })
    await receive({ quantity: '1', batchCode: 'soon', expiresAt: '2099-01-01T00:00:00Z' })

    const sameLine = { orderId: 'o-same', lines: [{ lineKey: 'l1', productId: bread.productId, quantity: '2.0000' }] }
    const results = await Promise.all(
      Array.from({ length: 5 }, () => module.useCases.deductOrder.execute({ companyId, input: sameLine })),
    )
    expect(
      results.flatMap((result) => result.lines.map((line) => line.status)).filter((status) => status === 'applied'),
    ).toHaveLength(1)

    await Promise.all(
      Array.from({ length: 8 }, (_unused, index) =>
        module.useCases.deductOrder.execute({
          companyId,
          input: { orderId: `o-${index}`, lines: [{ lineKey: 'l1', productId: bread.productId, quantity: '1.0000' }] },
        }),
      ),
    )
    // 2 kg − 0,2 − 8 × 0,1 = 1,0 kg; o lote que vence antes acabou primeiro.
    expect((await module.useCases.getLevel.execute({ companyId, ingredientId: flour.id })).quantity).toBe('1.0000')
    const batches = await module.useCases.listBatches.execute({
      companyId,
      query: { page: 1, pageSize: 10, onlyWithRemaining: true },
    })
    expect(batches.data.map((batch) => [batch.batchCode, batch.remainingQuantity])).toEqual([['late', '1.0000']])
    const [row] = await sql`SELECT count(*)::int AS total FROM stock.deductions WHERE company_id = ${companyId}`
    expect(row.total).toBe(9)
  })

  test('um inventário aberto por empresa (índice parcial) e aplicação ajusta o saldo', async () => {
    const opened = await module.useCases.openInventory.execute({ companyId, input: { note: '' } })
    await expect(module.useCases.openInventory.execute({ companyId, input: { note: '' } })).rejects.toMatchObject({
      code: 'STOCK_INVENTORY_ALREADY_OPEN',
    })
    await module.useCases.recordCounts.execute({
      companyId,
      id: opened.id,
      input: { counts: [{ ingredientId: flour.id, countedQuantity: '0.7500' }] },
    })
    await module.useCases.applyInventory.execute({ companyId, id: opened.id })
    expect((await module.useCases.getLevel.execute({ companyId, ingredientId: flour.id })).quantity).toBe('0.7500')
    const list = await module.useCases.listInventories.execute({ companyId, query: { page: 1, pageSize: 5 } })
    expect(list.data[0]).toMatchObject({ status: 'applied', lineCount: 1, countedCount: 1 })
  })

  test('varredura encontra lote com saldo que vence na janela', async () => {
    await receive({ quantity: '1', batchCode: 'tomorrow', expiresAt: new Date(Date.now() + 86_400_000).toISOString() })
    const result = await module.useCases.scanExpiringBatches.execute({ withinDays: 2 })
    expect(result.batches).toBeGreaterThanOrEqual(1)
  })
})
