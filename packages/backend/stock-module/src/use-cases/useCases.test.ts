/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { Recipe } from '@adatechnology/recipe-contracts'
import { receiveBatchSchema, type BelowMinimumEvent } from '@adatechnology/stock-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const FLOUR = '33333333-3333-4333-8333-333333333333'
const EGG = '44444444-4444-4444-8444-444444444444'

function recipe(productId: string, lines: Recipe['lines'], yieldPortions = '1.0000'): Recipe {
  return {
    id: crypto.randomUUID(),
    companyId: COMPANY,
    productId,
    yieldPortions,
    preparationTimeMinutes: null,
    instructions: '',
    lines,
    createdAt: '',
    updatedAt: '',
  }
}

function setup(params: Parameters<typeof buildTestModule>[0] = {}) {
  const built = buildTestModule(params)
  built.catalog.ingredients.set(FLOUR, { id: FLOUR, companyId: COMPANY, name: 'Farinha', unit: 'kg' })
  built.catalog.ingredients.set(EGG, { id: EGG, companyId: COMPANY, name: 'Ovo', unit: 'un' })
  built.catalog.recipes.push(
    recipe('bread', [{ id: 'l1', ingredientId: FLOUR, quantity: '500.0000', unit: 'g', notes: null, position: 0 }]),
    recipe(
      'cake',
      [{ id: 'l2', ingredientId: EGG, quantity: '1.0000', unit: 'dz', notes: null, position: 0 }],
      '4.0000',
    ),
  )
  const { useCases } = built.module
  const receive = (input: Record<string, unknown>) =>
    useCases.receiveBatch.execute({
      companyId: COMPANY,
      actorId: 'user-1',
      input: receiveBatchSchema.parse({ batchCode: 'L', ...input }),
    })
  return { ...built, useCases, receive }
}

describe('entrada, ajuste e perda', () => {
  it('entrada converte a unidade (5000 g num insumo em kg) e grava autor e motivo', async () => {
    const { useCases, receive } = setup()
    const level = await receive({ ingredientId: FLOUR, quantity: '5000', unit: 'g', costPerUnit: '4.5' })
    expect(level).toMatchObject({ quantity: '5.0000', unit: 'kg', ingredientName: 'Farinha' })
    const movements = await useCases.listMovements.execute({ companyId: COMPANY, query: { page: 1, pageSize: 10 } })
    expect(movements.data[0]).toMatchObject({
      kind: 'in',
      delta: '5.0000',
      actorId: 'user-1',
      reason: 'Entrada do lote L',
    })
  })

  it('perda de lote certo além do saldo é recusada e nada muda', async () => {
    const { useCases, receive } = setup()
    await receive({ ingredientId: FLOUR, quantity: '1' })
    const [batch] = (
      await useCases.listBatches.execute({
        companyId: COMPANY,
        query: { page: 1, pageSize: 10, onlyWithRemaining: true },
      })
    ).data
    await expect(
      useCases.recordLoss.execute({
        companyId: COMPANY,
        input: { ingredientId: FLOUR, quantity: '2.0000', batchId: batch!.id, reason: 'Venceu' },
      }),
    ).rejects.toMatchObject({ code: 'STOCK_INSUFFICIENT_BATCH' })
    expect((await useCases.getLevel.execute({ companyId: COMPANY, ingredientId: FLOUR })).quantity).toBe('1.0000')
  })

  it('ajuste para baixo consome FEFO e avisa o mínimo uma vez só', async () => {
    const events: BelowMinimumEvent[] = []
    const { useCases, receive } = setup({ hooks: { onBelowMinimum: (event) => void events.push(event) } })
    await receive({ ingredientId: FLOUR, quantity: '2', batchCode: 'late', expiresAt: '2026-05-01T00:00:00Z' })
    await receive({ ingredientId: FLOUR, quantity: '1', batchCode: 'soon', expiresAt: '2026-03-15T00:00:00Z' })
    await useCases.setMinimum.execute({ companyId: COMPANY, ingredientId: FLOUR, minimumQuantity: '2.5000' })
    await useCases.adjustStock.execute({
      companyId: COMPANY,
      input: { ingredientId: FLOUR, direction: 'decrease', quantity: '1.0000', reason: 'Conferência' },
    })
    await useCases.adjustStock.execute({
      companyId: COMPANY,
      input: { ingredientId: FLOUR, direction: 'decrease', quantity: '0.5000', reason: 'Conferência' },
    })
    expect(events.map((event) => event.quantity)).toEqual(['2.0000'])
    const batches = await useCases.listBatches.execute({
      companyId: COMPANY,
      query: { page: 1, pageSize: 10, onlyWithRemaining: true },
    })
    expect(batches.data.map((batch) => [batch.batchCode, batch.remainingQuantity])).toEqual([['late', '1.5000']])
    const level = await useCases.getLevel.execute({ companyId: COMPANY, ingredientId: FLOUR })
    expect(level).toMatchObject({ quantity: '1.5000', isBelowMinimum: true })
  })

  it('insumo de outra empresa é 404', async () => {
    const { receive, catalog } = setup()
    catalog.ingredients.set(FLOUR, { id: FLOUR, companyId: OTHER, name: 'Farinha', unit: 'kg' })
    await expect(receive({ ingredientId: FLOUR, quantity: '1' })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('baixa por pedido', () => {
  it('pela ficha, idempotente por linha, com o que faltar como saída sem lote', async () => {
    const { useCases, receive } = setup()
    await receive({ ingredientId: FLOUR, quantity: '1' })
    const input = {
      orderId: 'o-1',
      lines: [
        { lineKey: 'i-1', productId: 'bread', quantity: '3.0000' },
        { lineKey: 'i-2', productId: 'cake', quantity: '2.0000' },
        { lineKey: 'i-3', productId: 'soda', quantity: '1.0000' },
      ],
    }
    const first = await useCases.deductOrder.execute({ companyId: COMPANY, input })
    expect(first.lines.map((line) => line.status)).toEqual(['applied', 'applied', 'applied'])
    expect(first.productsWithoutRecipe).toEqual(['soda'])
    const second = await useCases.deductOrder.execute({ companyId: COMPANY, input })
    expect(second.lines.map((line) => line.status)).toEqual(['already_applied', 'already_applied', 'already_applied'])

    expect((await useCases.getLevel.execute({ companyId: COMPANY, ingredientId: FLOUR })).quantity).toBe('-0.5000')
    // 2 bolos de 4 porções com 1 dúzia: 6 ovos.
    expect((await useCases.getLevel.execute({ companyId: COMPANY, ingredientId: EGG })).quantity).toBe('-6.0000')
    const levels = await useCases.getLevels.getLevels({ companyId: COMPANY, ingredientIds: [FLOUR, EGG] })
    expect(levels).toHaveLength(2)
  })

  it('desligado para a empresa: nada baixa, rotas recusam e o saldo para a ficha vem vazio', async () => {
    const { useCases } = setup({ config: { isEnabledForCompany: (companyId) => companyId !== COMPANY } })
    const result = await useCases.deductOrder.execute({
      companyId: COMPANY,
      input: { orderId: 'o', lines: [{ lineKey: 'a', productId: 'bread', quantity: '1' }] },
    })
    expect(result.lines[0]?.status).toBe('disabled')
    expect(await useCases.getLevels.getLevels({ companyId: COMPANY, ingredientIds: [FLOUR] })).toEqual([])
    await expect(
      useCases.listLevels.execute({ companyId: COMPANY, query: { page: 1, pageSize: 10 } }),
    ).rejects.toMatchObject({ code: 'STOCK_DISABLED' })
  })
})

describe('inventário e validade', () => {
  it('um aberto por vez; aplica contra o saldo da hora de aplicar', async () => {
    const { useCases, receive } = setup()
    await receive({ ingredientId: FLOUR, quantity: '10' })
    const inventory = await useCases.openInventory.execute({ companyId: COMPANY, input: { note: 'Mensal' } })
    expect(inventory.lines.map((line) => [line.ingredientName, line.expectedQuantity])).toEqual([
      ['Farinha', '10.0000'],
    ])
    await expect(useCases.openInventory.execute({ companyId: COMPANY, input: { note: '' } })).rejects.toMatchObject({
      code: 'STOCK_INVENTORY_ALREADY_OPEN',
    })

    await useCases.recordCounts.execute({
      companyId: COMPANY,
      id: inventory.id,
      input: { counts: [{ ingredientId: FLOUR, countedQuantity: '7.0000' }] },
    })
    // Venda durante a contagem: 2 kg saíram; o contado (7) prevalece sobre o saldo do momento (8).
    await useCases.deductOrder.execute({
      companyId: COMPANY,
      input: { orderId: 'o', lines: [{ lineKey: 'a', productId: 'bread', quantity: '4' }] },
    })
    const applied = await useCases.applyInventory.execute({ companyId: COMPANY, id: inventory.id })
    expect(applied.status).toBe('applied')
    expect((await useCases.getLevel.execute({ companyId: COMPANY, ingredientId: FLOUR })).quantity).toBe('7.0000')
    await expect(useCases.applyInventory.execute({ companyId: COMPANY, id: inventory.id })).rejects.toMatchObject({
      code: 'STOCK_INVENTORY_CLOSED',
    })
    const adjust = await useCases.listMovements.execute({
      companyId: COMPANY,
      query: { page: 1, pageSize: 1, kind: ['adjust'] },
    })
    expect(adjust.data[0]?.delta).toBe('-1.0000')
  })

  it('varredura de validade entrega os lotes por empresa ao gancho', async () => {
    const seen: string[] = []
    const { useCases, receive } = setup({
      hooks: {
        onBatchesExpiring: ({ batches }) =>
          void seen.push(...batches.map((batch) => `${batch.batchCode}:${batch.ingredientName}`)),
      },
    })
    await receive({ ingredientId: FLOUR, quantity: '1', batchCode: 'vence', expiresAt: '2026-03-12T00:00:00Z' })
    await receive({ ingredientId: FLOUR, quantity: '1', batchCode: 'longe', expiresAt: '2026-06-01T00:00:00Z' })
    expect(await useCases.scanExpiringBatches.execute({ withinDays: 7 })).toEqual({ companies: 1, batches: 1 })
    expect(seen).toEqual(['vence:Farinha'])
  })
})
