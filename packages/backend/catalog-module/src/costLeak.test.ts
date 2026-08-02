/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Critério de aceite da §10 da spec: **`costPriceInCents` não sai na projeção destinada ao
 * cliente final.** Estava documentado em três lugares e verificado em nenhum — este arquivo
 * fecha a lacuna.
 *
 * Cobre as duas barreiras: a de SQL (a coluna não é sequer selecionada) e a de mapeamento
 * (`toProduct` descarta o campo mesmo recebendo linha completa).
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { CUSTOMER_FACING_PRODUCT_COLUMNS } from './repositories/ProductRepository'
import { products } from './schema/schema'
import { toProduct } from './shared/toContract'
import type { ProductRow } from './schema/schema'

const COST_COLUMN = 'cost_price_in_cents'

function buildRow(): ProductRow {
  return {
    id: randomUUID(),
    companyId: randomUUID(),
    catalogId: null,
    sectionId: null,
    name: 'Whisky 12 anos',
    description: null,
    priceInCents: 19900,
    // O número que não pode vazar: quem compra não vê a margem do lojista.
    costPriceInCents: 8400,
    unit: 'un',
    barcode: null,
    imageUrl: null,
    imageStorageKey: null,
    inventory: 3,
    active: true,
    sortOrder: 0,
    availability: 'in stock',
    preparationTimeMinutes: null,
    preparationInstructions: null,
    externalId: null,
    syncStatus: null,
    syncError: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ProductRow
}

describe('barreira de SQL — a coluna de custo nem é selecionada', () => {
  it('CUSTOMER_FACING_PRODUCT_COLUMNS não inclui o custo', () => {
    expect(Object.keys(CUSTOMER_FACING_PRODUCT_COLUMNS)).not.toContain('costPriceInCents')
  })

  it('nenhuma coluna da projeção é a de custo, olhando o nome real no banco', () => {
    // Os NOMES de coluna do banco, não as chaves do objeto: é o que pega alguém mapear
    // `costPriceInCents` sob outra chave e achar que escondeu.
    const columnNames = Object.values(CUSTOMER_FACING_PRODUCT_COLUMNS).map((column) => column.name)

    expect(columnNames).not.toContain(COST_COLUMN)
    // Sanidade: a projeção precisa de fato trazer as colunas que o cliente usa.
    expect(columnNames).toContain('price_in_cents')
    expect(columnNames).toContain('name')
  })

  it('a tabela TEM a coluna — a ausência acima é escolha, não inexistência', () => {
    expect(Object.keys(products)).toContain('costPriceInCents')
  })
})

describe('barreira de mapeamento — toProduct descarta o custo', () => {
  it("projection 'customer' não devolve costPriceInCents nem com linha completa", () => {
    const product = toProduct(buildRow(), 'customer')

    expect('costPriceInCents' in product).toBe(false)
    expect(JSON.stringify(product)).not.toContain('8400')
  })

  it("projection 'admin' devolve o custo — é a tela de quem precifica", () => {
    const product = toProduct(buildRow(), 'admin')

    expect(product.costPriceInCents).toBe(8400)
  })

  it('o default é admin: quem esquece o argumento vê o custo, não o contrário', () => {
    // Escolha deliberada. O default seguro seria `customer`, mas aí a tela de precificação
    // silenciosamente perderia o campo — erro que ninguém percebe. Vazar exige passar por
    // `lookup`, que usa as leituras restritas.
    expect(toProduct(buildRow()).costPriceInCents).toBe(8400)
  })
})
