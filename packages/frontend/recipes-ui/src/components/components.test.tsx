/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor (sem DOM): o que aparece, o que some por ausência de capacidade, rótulos
 * do host e ausência de controle nativo.
 */

import { describe, expect, it } from 'bun:test'
import { calculateRecipeCost, type Ingredient } from '@adatechnology/recipe-contracts'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { RecipesProvider, type RecipesProviderProps } from '../providers/RecipesProvider'
import type { RecipesApi } from '../providers/types'
import { IngredientDialog } from './IngredientDialog'
import { IngredientTable } from './IngredientTable'
import { IngredientsWorkspace } from './IngredientsWorkspace'
import { RecipeCostSummary } from './RecipeCostSummary'
import { SelectField } from './SelectField'
import { ShoppingListWorkspace } from './ShoppingListWorkspace'

const FLOUR: Ingredient = {
  id: 'i1',
  companyId: 'c',
  name: 'Farinha de trigo',
  unit: 'kg',
  costPerUnit: '5.5000',
  supplier: 'Moinho',
  notes: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
}

const readOnlyApi: RecipesApi = {
  listIngredients: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
  getRecipe: async () => null,
}

const render = (node: ReactNode, props: Partial<RecipesProviderProps> = {}) =>
  renderToStaticMarkup(
    <RecipesProvider api={readOnlyApi} {...props}>
      {node}
    </RecipesProvider>,
  )

describe('IngredientsWorkspace', () => {
  it('busca com rótulo, filtro de unidade e sem "Novo" quando a API não cria', () => {
    const html = render(<IngredientsWorkspace />)
    expect(html).toContain('Buscar')
    expect(html).toContain('aria-pressed')
    expect(html).not.toContain('Novo insumo')
    expect(html).not.toContain('<select')
  })

  it('com criação, mostra o botão; rótulo trocado pelo host', () => {
    const html = render(<IngredientsWorkspace />, {
      api: { ...readOnlyApi, createIngredient: async () => FLOUR },
      messages: { ingredientsTitle: 'Matérias-primas' },
    })
    expect(html).toContain('Novo insumo')
    expect(html).toContain('Matérias-primas')
  })
})

describe('IngredientTable', () => {
  it('custo em moeda, unidade em pílula, ações e slot do host', () => {
    const html = render(
      <IngredientTable
        rows={[FLOUR]}
        sort="name"
        order="asc"
        onToggleSort={() => undefined}
        onEdit={() => undefined}
        renderRowActions={() => <span>Estoque</span>}
      />,
    )
    expect(html).toContain('R$')
    expect(html).toContain('5,50')
    expect(html).toContain('arc-chip')
    expect(html).toContain('Estoque')
    expect(html).toContain('aria-label="Editar"')
    expect(html).not.toContain('aria-label="Excluir"')
  })
})

describe('IngredientDialog e SelectField', () => {
  it('unidade sem select nativo; custo com dica da unidade', () => {
    const html = render(<IngredientDialog ingredient={FLOUR} onSaved={() => undefined} onCancel={() => undefined} />)
    expect(html).not.toContain('<select')
    expect(html).toContain('Quanto custa 1 kg.')
    expect(html).toContain('value="5,5"')
  })

  it('até três opções vira grupo de botões; host pode injetar o próprio', () => {
    const options = [
      { id: 'g', label: 'g' },
      { id: 'kg', label: 'kg' },
    ]
    expect(render(<SelectField id="u" label="Unidade" value="g" options={options} onChange={() => undefined} />)).toContain('role="radiogroup"')
    const injected = render(<SelectField id="u" label="Unidade" value="g" options={options} onChange={() => undefined} />, {
      renderSelect: (props) => <span>host:{props.label}</span>,
    })
    expect(injected).toContain('host:Unidade')
  })
})

describe('RecipeCostSummary', () => {
  it('margem negativa em destaque; sem preço pede o preço', () => {
    const recipe = { productId: 'p', yieldPortions: '1', lines: [{ id: 'l', ingredientId: 'i1', quantity: '1', unit: 'kg' as const }] }
    const negative = render(<RecipeCostSummary cost={calculateRecipeCost({ recipe, ingredients: [FLOUR], salePriceCents: 400 })} />)
    expect(negative).toContain('arc-report-card--danger')
    const withoutPrice = render(<RecipeCostSummary cost={calculateRecipeCost({ recipe, ingredients: [FLOUR] })} />)
    expect(withoutPrice).toContain('Informe o preço de venda')
  })
})

describe('ShoppingListWorkspace', () => {
  it('origens de quantidade do host viram botões', () => {
    const html = render(
      <ShoppingListWorkspace
        products={[{ id: 'p', name: 'Pão' }]}
        plannedItemsSources={[{ id: 'tomorrow', label: 'Encomendas de amanhã', load: async () => [] }]}
      />,
    )
    expect(html).toContain('Encomendas de amanhã')
    expect(html).toContain('Gerar lista')
  })
})
