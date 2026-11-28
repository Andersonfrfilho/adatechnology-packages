/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { RecipesProvider, type RecipesApi } from '@adatechnology/recipes-ui'
import type { StockBatch, StockLevelView, StockMovement } from '@adatechnology/stock-contracts'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { StockProvider } from '../providers/StockProvider'
import type { StockApi } from '../providers/types'
import { InventoryWorkspace } from './InventoryWorkspace'
import { IngredientStockButton } from './IngredientStockButton'
import { BatchesTable, MovementsTable } from './StockHistory'
import { levelStatus, StockLevelsWorkspace } from './StockLevelsWorkspace'
import { StockMovementForm } from './StockMovementForm'

const recipesApi: RecipesApi = {
  listIngredients: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
  getRecipe: async () => null,
}

const LEVEL: StockLevelView = {
  ingredientId: 'i1',
  ingredientName: 'Farinha',
  unit: 'kg',
  quantity: '2.5000',
  minimumQuantity: '3.0000',
  isBelowMinimum: true,
  updatedAt: '2026-03-10T12:00:00.000Z',
}

const stockApi: StockApi = {
  listLevels: async () => ({ data: [LEVEL], pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 } }),
  getLevel: async () => LEVEL,
  listBatches: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 50, totalPages: 1 } }),
  listMovements: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 } }),
}

const render = (node: ReactNode, api: StockApi = stockApi) =>
  renderToStaticMarkup(
    <RecipesProvider api={recipesApi}>
      <StockProvider api={api}>{node}</StockProvider>
    </RecipesProvider>,
  )

describe('stock-ui', () => {
  it('situação do saldo', () => {
    expect(levelStatus(LEVEL)).toBe('below')
    expect(levelStatus({ ...LEVEL, quantity: '-1.0000' })).toBe('negative')
    expect(levelStatus({ ...LEVEL, isBelowMinimum: false })).toBe('ok')
  })

  it('lista de saldos com filtro e sem inventário quando a API não tem', () => {
    expect(render(<StockLevelsWorkspace />)).toContain('Só abaixo do mínimo')
    expect(render(<InventoryWorkspace />)).toBe('')
  })

  it('formulário só com as ações que a API oferece; validade digitada sem controle nativo', () => {
    expect(render(<StockMovementForm level={LEVEL} batches={[]} onRecorded={() => undefined} />)).toBe('')
    const html = render(<StockMovementForm level={LEVEL} batches={[]} onRecorded={() => undefined} />, {
      ...stockApi,
      receiveBatch: async () => LEVEL,
      recordLoss: async () => LEVEL,
    })
    expect(html).toContain('Validade (dd/mm/aaaa)')
    expect(html).not.toContain('type="date"')
    expect(html).not.toContain('<select')
  })

  it('lotes com aviso de validade e movimentos com sinal', () => {
    const batch: StockBatch = {
      id: 'b1',
      ingredientId: 'i1',
      batchCode: 'L-9',
      unit: 'kg',
      quantity: '5.0000',
      remainingQuantity: '1.5000',
      costPerUnit: null,
      expiresAt: '2026-03-12T00:00:00.000Z',
      receivedAt: '2026-03-01T00:00:00.000Z',
    }
    expect(render(<BatchesTable batches={[batch]} now={new Date('2026-03-10T00:00:00Z').getTime()} />)).toContain('Vence em breve')
    const movement: StockMovement = {
      id: 'm1',
      ingredientId: 'i1',
      batchId: null,
      kind: 'loss',
      delta: '-0.5000',
      unit: 'kg',
      reason: 'Venceu',
      actorId: null,
      sourceKey: null,
      createdAt: '2026-03-10T12:00:00.000Z',
    }
    const html = render(<MovementsTable movements={[movement]} />)
    expect(html).toContain('Perda')
    expect(html).toContain('-0,5 kg')
  })

  it('botão para o slot da lista de insumos', () => {
    expect(render(<IngredientStockButton ingredientId="i1" ingredientName="Farinha" />)).toContain('aria-label="Estoque"')
  })
})
