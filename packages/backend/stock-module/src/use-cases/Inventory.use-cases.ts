/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Inventário: abre com o saldo esperado de cada insumo, recebe as contagens (parciais, em várias
 * idas) e, ao aplicar, ajusta cada contado para o que foi visto — contra o saldo da hora de aplicar,
 * para não desfazer vendas feitas durante a contagem.
 */

import {
  compare,
  convertQuantity,
  formatDecimal,
  parseDecimal,
  subtract,
  ZERO,
  type Paginated,
  type RecipeUnit,
} from '@adatechnology/recipe-contracts'
import {
  INVENTORY_STATUS,
  InventoryAlreadyOpenError,
  InventoryClosedError,
  InventoryNotFoundError,
  MOVEMENT_KIND,
  StockIncompatibleUnitError,
  type InventoryCount,
  type InventoryCountSummary,
  type ListInventoriesQuery,
  type OpenInventoryData,
  type RecordCountsData,
  type StockIngredient,
} from '@adatechnology/stock-contracts'

import type { ActorParams } from '../shared/actor'
import { isUniqueViolation } from '../shared/postgresErrors'
import { assertStockEnabled, loadIngredients, notifyAfterCommit } from '../shared/stockContext'
import { applyLedgerChange, toLevelUnit, type LedgerResult } from '../shared/stockLedger'
import { inIngredientUnit, toPaginated } from '../shared/toContract'
import type { InventoryRecord, InventorySummaryRow, StockDependencies } from './stockModule.types'

const MAX_LINES = 2_000

function toInventory(record: InventoryRecord, ingredients: ReadonlyMap<string, StockIngredient>): InventoryCount {
  return {
    ...toSummaryBase(record.count),
    lines: record.lines.map((line) => {
      const ingredient = ingredients.get(line.ingredientId)
      const expected = inIngredientUnit({
        value: line.expectedQuantity,
        from: line.unit,
        ...(ingredient ? { ingredient } : {}),
      })
      return {
        ingredientId: line.ingredientId,
        ingredientName: ingredient?.name ?? null,
        unit: expected.unit,
        expectedQuantity: expected.value,
        countedQuantity:
          line.countedQuantity === null
            ? null
            : inIngredientUnit({ value: line.countedQuantity, from: line.unit, ...(ingredient ? { ingredient } : {}) })
                .value,
      }
    }),
  }
}

function toSummaryBase(count: InventoryRecord['count']): Omit<InventoryCount, 'lines'> {
  return {
    id: count.id,
    status: count.status as InventoryCount['status'],
    note: count.note,
    actorId: count.actorId,
    createdAt: count.createdAt.toISOString(),
    appliedAt: count.appliedAt?.toISOString() ?? null,
  }
}

async function withNames(
  dependencies: StockDependencies,
  companyId: string,
  record: InventoryRecord,
): Promise<InventoryCount> {
  const ingredients = await loadIngredients({
    dependencies,
    companyId,
    ingredientIds: record.lines.map((line) => line.ingredientId),
  })
  return toInventory(record, ingredients)
}

export class OpenInventoryUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: ActorParams & { readonly input: OpenInventoryData }): Promise<InventoryCount> {
    const { dependencies } = this
    await assertStockEnabled(dependencies, params.companyId)
    const ids = params.input.ingredientIds?.length
      ? params.input.ingredientIds
      : await dependencies.persistence.stock.listLevelIngredientIds({ companyId: params.companyId, limit: MAX_LINES })
    const ingredients = await loadIngredients({ dependencies, companyId: params.companyId, ingredientIds: ids })
    const levels = new Map(
      (
        await dependencies.persistence.stock.findLevels({
          companyId: params.companyId,
          ingredientIds: [...ingredients.keys()],
        })
      ).map((row) => [row.ingredientId, row]),
    )
    const lines = [...ingredients.values()].map((ingredient) => {
      const level = levels.get(ingredient.id)
      return {
        ingredientId: ingredient.id,
        unit: (level?.unit ?? ingredient.unit) as RecipeUnit,
        expectedQuantity: level?.quantity ?? '0',
        countedQuantity: null,
      }
    })
    try {
      const record = await dependencies.persistence.inventories.insert({
        companyId: params.companyId,
        note: params.input.note,
        actorId: params.actorId ?? null,
        lines,
        now: dependencies.clock.now(),
      })
      return toInventory(record, ingredients)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const open = await dependencies.persistence.inventories.findOpen({ companyId: params.companyId })
      throw new InventoryAlreadyOpenError(open?.id ?? '')
    }
  }
}

export class GetInventoryUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: { readonly companyId: string; readonly id: string }): Promise<InventoryCount> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const record = await this.dependencies.persistence.inventories.find(params)
    if (!record) throw new InventoryNotFoundError(params.id)
    return withNames(this.dependencies, params.companyId, record)
  }
}

export class ListInventoriesUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly query: ListInventoriesQuery
  }): Promise<Paginated<InventoryCountSummary>> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const page = await this.dependencies.persistence.inventories.list({ companyId: params.companyId, ...params.query })
    return toPaginated({
      ...page,
      ...params.query,
      map: (row: InventorySummaryRow) => ({
        ...toSummaryBase(row),
        lineCount: row.lineCount,
        countedCount: row.countedCount,
      }),
    })
  }
}

export class RecordCountsUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly id: string
    readonly input: RecordCountsData
  }): Promise<InventoryCount> {
    const { dependencies } = this
    await assertStockEnabled(dependencies, params.companyId)
    const record = await dependencies.persistence.inventories.find(params)
    if (!record) throw new InventoryNotFoundError(params.id)
    if (record.count.status !== INVENTORY_STATUS.OPEN) throw new InventoryClosedError(params.id)
    const ingredients = await loadIngredients({
      dependencies,
      companyId: params.companyId,
      ingredientIds: record.lines.map((line) => line.ingredientId),
    })
    const lineById = new Map(record.lines.map((line) => [line.ingredientId, line]))
    // Contado na unidade atual do insumo; gravado na unidade da linha.
    const counts = params.input.counts.flatMap((entry): { ingredientId: string; countedQuantity: string | null }[] => {
      const line = lineById.get(entry.ingredientId)
      if (!line) return []
      if (entry.countedQuantity === null) return [{ ingredientId: entry.ingredientId, countedQuantity: null }]
      const from = (ingredients.get(entry.ingredientId)?.unit ?? line.unit) as RecipeUnit
      const converted = convertQuantity({
        quantity: parseDecimal(entry.countedQuantity),
        from,
        to: line.unit as RecipeUnit,
      })
      if (!converted) throw new StockIncompatibleUnitError({ unit: from, ingredientUnit: line.unit })
      return [{ ingredientId: entry.ingredientId, countedQuantity: formatDecimal(converted) }]
    })
    await dependencies.persistence.inventories.setCounts({ companyId: params.companyId, id: params.id, counts })
    const updated = await dependencies.persistence.inventories.find(params)
    if (!updated) throw new InventoryNotFoundError(params.id)
    return toInventory(updated, ingredients)
  }
}

export class ApplyInventoryUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: ActorParams & { readonly id: string }): Promise<InventoryCount> {
    const { dependencies } = this
    await assertStockEnabled(dependencies, params.companyId)
    const now = dependencies.clock.now()
    const results: LedgerResult[] = []
    const record = await dependencies.persistence.stock.transaction(async (transaction) => {
      const locked = await transaction.lockInventory({ companyId: params.companyId, id: params.id })
      if (!locked) throw new InventoryNotFoundError(params.id)
      if (locked.count.status !== INVENTORY_STATUS.OPEN) throw new InventoryClosedError(params.id)
      const counted = locked.lines.filter((line) => line.countedQuantity !== null)
      const levels = await transaction.lockLevels({
        companyId: params.companyId,
        ingredients: counted.map((line) => ({ id: line.ingredientId, unit: line.unit as RecipeUnit })),
        now,
      })
      for (const line of counted) {
        // Sequencial dentro da transação: cada ajuste grava lote e nível do seu insumo.
        const level = levels.get(line.ingredientId)
        if (!level) continue
        const countedInLevel = toLevelUnit({
          quantity: parseDecimal(line.countedQuantity ?? '0'),
          from: line.unit as RecipeUnit,
          level,
        })
        const difference = subtract(countedInLevel, parseDecimal(level.quantity))
        if (compare(difference, ZERO) === 0) continue
        results.push(
          await applyLedgerChange({
            transaction,
            level,
            change: {
              companyId: params.companyId,
              ingredientId: line.ingredientId,
              delta: difference,
              unit: level.unit as RecipeUnit,
              kind: MOVEMENT_KIND.ADJUST,
              reason: `Inventário ${locked.count.createdAt.toISOString().slice(0, 10)}`,
              actorId: params.actorId ?? null,
              sourceKey: `inventory:${locked.count.id}`,
              batch: compare(difference, ZERO) < 0 ? { mode: 'fefo' } : { mode: 'none' },
              now,
            },
          }),
        )
      }
      await transaction.closeInventory({
        companyId: params.companyId,
        id: params.id,
        status: INVENTORY_STATUS.APPLIED,
        now,
      })
      return { ...locked, count: { ...locked.count, status: INVENTORY_STATUS.APPLIED, appliedAt: now } }
    })
    await notifyAfterCommit({ dependencies, actor: params, results, kinds: [MOVEMENT_KIND.ADJUST] })
    return withNames(dependencies, params.companyId, record)
  }
}

export class CancelInventoryUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: { readonly companyId: string; readonly id: string }): Promise<void> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const now = this.dependencies.clock.now()
    await this.dependencies.persistence.stock.transaction(async (transaction) => {
      const locked = await transaction.lockInventory(params)
      if (!locked) throw new InventoryNotFoundError(params.id)
      if (locked.count.status !== INVENTORY_STATUS.OPEN) throw new InventoryClosedError(params.id)
      await transaction.closeInventory({ ...params, status: INVENTORY_STATUS.CANCELLED, now })
    })
  }
}
