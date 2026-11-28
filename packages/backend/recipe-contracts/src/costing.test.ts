/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { calculateRecipeCost } from './costing'
import { buildShoppingList, shoppingListTable } from './shoppingList'
import { calculateIngredientNeedsExact, formatIngredientNeeds } from './needs'
import type { Ingredient, Recipe } from './recipe.types'
import { saveRecipeSchema, createIngredientSchema, decimalSchema } from './schemas'

const NOW = '2026-01-01T00:00:00.000Z'

function ingredient(id: string, values: Partial<Ingredient>): Ingredient {
  return {
    id,
    companyId: 'company',
    name: id,
    unit: 'kg',
    costPerUnit: '0.0000',
    supplier: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...values,
  }
}

const FLOUR = ingredient('flour', { name: 'Farinha', unit: 'kg', costPerUnit: '5.0000' })
const MILK = ingredient('milk', { name: 'Leite', unit: 'l', costPerUnit: '4.5000' })
const EGG = ingredient('egg', { name: 'Ovo', unit: 'un', costPerUnit: '0.8000' })

const CAKE: Recipe = {
  id: 'r1',
  companyId: 'company',
  productId: 'cake',
  yieldPortions: '8.0000',
  preparationTimeMinutes: 50,
  instructions: '',
  lines: [
    { id: 'l1', ingredientId: 'flour', quantity: '500.0000', unit: 'g', notes: null, position: 0 },
    { id: 'l2', ingredientId: 'milk', quantity: '300.0000', unit: 'ml', notes: null, position: 1 },
    { id: 'l3', ingredientId: 'egg', quantity: '0.2500', unit: 'dz', notes: null, position: 2 },
  ],
  createdAt: NOW,
  updatedAt: NOW,
}

describe('custo da ficha', () => {
  it('converte a unidade da linha e divide pelas porções', () => {
    const cost = calculateRecipeCost({ recipe: CAKE, ingredients: [FLOUR, MILK, EGG], salePriceCents: 1000 })
    // 0,5 kg × 5 + 0,3 l × 4,5 + 3 un × 0,8 = 2,50 + 1,35 + 2,40 = 6,25
    expect(cost.totalCost).toBe('6.2500')
    expect(cost.totalCostCents).toBe(625)
    expect(cost.costPerPortion).toBe('0.7813')
    expect(cost.costPerPortionCents).toBe(78)
    expect(cost.marginCents).toBe(922)
    expect(cost.marginBasisPoints).toBe(9219)
    expect(cost.lines.map((line) => line.quantityInIngredientUnit)).toEqual(['0.5000', '0.3000', '3.0000'])
  })

  it('insumo apagado entra como aviso, e sem preço não há margem', () => {
    const cost = calculateRecipeCost({ recipe: CAKE, ingredients: [FLOUR] })
    expect(cost.missingIngredientIds).toEqual(['milk', 'egg'])
    expect(cost.totalCost).toBe('2.5000')
    expect(cost.marginBasisPoints).toBeNull()
  })

  it('margem negativa quando o custo passa do preço', () => {
    const cost = calculateRecipeCost({
      recipe: { ...CAKE, yieldPortions: '1' },
      ingredients: [FLOUR, MILK, EGG],
      salePriceCents: 500,
    })
    expect(cost.marginCents).toBe(-125)
    expect(cost.marginBasisPoints).toBe(-2500)
  })
})

describe('necessidade e lista de compras', () => {
  it('soma produtos repetidos e respeita o rendimento', () => {
    const exact = calculateIngredientNeedsExact({
      items: [
        { productId: 'cake', quantity: '4' },
        { productId: 'cake', quantity: '4' },
        { productId: 'bread', quantity: '2' },
      ],
      recipes: [CAKE],
      ingredients: [FLOUR, MILK, EGG],
    })
    expect(exact.productsWithoutRecipe).toEqual(['bread'])
    expect(formatIngredientNeeds(exact.needs)).toEqual([
      { ingredientId: 'flour', unit: 'kg', quantity: '0.5000' },
      { ingredientId: 'milk', unit: 'l', quantity: '0.3000' },
      { ingredientId: 'egg', unit: 'un', quantity: '3.0000' },
    ])
  })

  it('sem estoque mostra o bruto; com estoque desconta e nunca fica negativo', () => {
    const items = [{ productId: 'cake', quantity: '16' }]
    const gross = buildShoppingList({ items, recipes: [CAKE], ingredients: [FLOUR, MILK, EGG] })
    expect(gross.hasStockData).toBe(false)
    expect(gross.rows.map((row) => [row.name, row.netQuantity, row.stockQuantity])).toEqual([
      ['Farinha', '1.0000', null],
      ['Leite', '0.6000', null],
      ['Ovo', '6.0000', null],
    ])
    expect(gross.totalEstimatedCostCents).toBe(1250)

    const net = buildShoppingList({
      items,
      recipes: [CAKE],
      ingredients: [FLOUR, MILK, EGG],
      stockLevels: [
        { ingredientId: 'flour', quantity: '0.25' },
        { ingredientId: 'egg', quantity: '10' },
        { ingredientId: 'milk', quantity: '-2' },
      ],
    })
    expect(net.rows.map((row) => [row.name, row.netQuantity])).toEqual([
      ['Farinha', '0.7500'],
      ['Leite', '0.6000'],
      ['Ovo', '0.0000'],
    ])
    expect(shoppingListTable(net).header).toContain('Em estoque')
    expect(shoppingListTable(gross).header).not.toContain('Em estoque')
  })
})

describe('schemas', () => {
  it('decimal aceita vírgula e recusa mais de 4 casas', () => {
    expect(decimalSchema.parse('1,5')).toBe('1.5000')
    expect(decimalSchema.safeParse('1.23456').success).toBe(false)
    expect(decimalSchema.safeParse('-1').success).toBe(false)
  })

  it('ficha com padrões e sem linha repetida', () => {
    expect(saveRecipeSchema.parse({})).toEqual({
      yieldPortions: '1.0000',
      preparationTimeMinutes: null,
      instructions: '',
      lines: [],
    })
    const id = '7b0f2a52-5f3a-4a39-9d0e-6a3a7f1d2c11'
    const line = { id, ingredientId: id, quantity: '1', unit: 'g' }
    expect(saveRecipeSchema.safeParse({ lines: [line, line] }).success).toBe(false)
    expect(saveRecipeSchema.safeParse({ lines: [{ ...line, quantity: '0' }] }).success).toBe(false)
  })

  it('insumo: texto vazio vira null', () => {
    expect(createIngredientSchema.parse({ name: ' Açúcar ', unit: 'kg', supplier: '' })).toEqual({
      name: 'Açúcar',
      unit: 'kg',
      costPerUnit: '0.0000',
      supplier: null,
      notes: null,
    })
  })
})
