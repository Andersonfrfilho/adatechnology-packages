/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote não faz `fetch`: o host implementa esta interface (sobre as rotas do `recipe-module`, um
 * BFF, ou o que tiver) e injeta no `RecipesProvider`. Método ausente = recurso ausente na tela.
 */

import type {
  CreateIngredientInput,
  ExportFormat,
  Ingredient,
  IngredientSortField,
  Paginated,
  RecipeDetail,
  RecipeUnit,
  SaveRecipeInput,
  ShoppingList,
  UpdateIngredientInput,
} from '@adatechnology/recipe-contracts'
import type { ReactNode } from 'react'

export type SortOrder = 'asc' | 'desc'

export type ListIngredientsParams = {
  readonly page: number
  readonly pageSize: number
  readonly search?: string
  /** Seleção múltipla. */
  readonly units?: readonly RecipeUnit[]
  readonly sort?: IngredientSortField
  readonly order?: SortOrder
}

export type IngredientFiltersParams = Omit<ListIngredientsParams, 'page' | 'pageSize'>

export type PlannedItemInput = { readonly productId: string; readonly quantity: string }

export type RecipesApi = {
  listIngredients(params: ListIngredientsParams): Promise<Paginated<Ingredient>>
  /** Ausente: sem "Novo insumo". */
  createIngredient?(input: CreateIngredientInput): Promise<Ingredient>
  /** Ausente: sem "Editar". */
  updateIngredient?(id: string, input: UpdateIngredientInput): Promise<Ingredient>
  /** Ausente: sem "Excluir". */
  removeIngredient?(id: string): Promise<void>
  /** Arquivo de todos os resultados do filtro, gerado no servidor. Ausente: só "esta página". */
  exportIngredients?(params: {
    readonly filters: IngredientFiltersParams
    readonly format: ExportFormat
  }): Promise<Blob>
  /** `null` quando o produto ainda não tem ficha (o host traduz o 404). */
  getRecipe(productId: string, options?: { readonly salePriceCents?: number }): Promise<RecipeDetail | null>
  /** Ausente: ficha só leitura. */
  saveRecipe?(
    productId: string,
    input: SaveRecipeInput,
    options?: { readonly salePriceCents?: number },
  ): Promise<RecipeDetail>
  removeRecipe?(productId: string): Promise<void>
  /** Ausente: sem a tela de lista de compras. */
  buildShoppingList?(items: readonly PlannedItemInput[]): Promise<ShoppingList>
  exportShoppingList?(items: readonly PlannedItemInput[], format: ExportFormat): Promise<Blob>
}

export type SelectOption = { readonly id: string; readonly label: string }

export type SelectInputProps = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly SelectOption[]
  readonly onChange: (value: string) => void
}

/** Troca o seletor do pacote pelo menu de seleção do design system do host. */
export type RenderSelect = (props: SelectInputProps) => ReactNode

/** Produto do host para a lista de compras (o módulo não tem produtos). */
export type ProductOption = { readonly id: string; readonly name: string }

/** Origem de quantidades previstas que o host oferece (encomendas de amanhã, reservas do fim de semana). */
export type PlannedItemsSource = {
  readonly id: string
  readonly label: string
  readonly load: () => Promise<readonly PlannedItemInput[]>
}
