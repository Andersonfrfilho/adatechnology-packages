/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { RecipesProvider, useRecipesApi, useRecipesText, useRecipesContext } from './providers/RecipesProvider'
export type { RecipesProviderProps, RecipesText } from './providers/RecipesProvider'
export type {
  RecipesApi,
  ListIngredientsParams,
  IngredientFiltersParams,
  PlannedItemInput,
  PlannedItemsSource,
  ProductOption,
  RenderSelect,
  SelectInputProps,
  SelectOption,
  SortOrder,
} from './providers/types'

export { IngredientsWorkspace } from './components/IngredientsWorkspace'
export type { IngredientsWorkspaceProps } from './components/IngredientsWorkspace'
export { RecipeEditor } from './components/RecipeEditor'
export type { RecipeEditorProps } from './components/RecipeEditor'
export { RecipeCostSummary } from './components/RecipeCostSummary'
export type { RecipeCostSummaryProps } from './components/RecipeCostSummary'
export { ShoppingListWorkspace } from './components/ShoppingListWorkspace'
export type { ShoppingListWorkspaceProps } from './components/ShoppingListWorkspace'
export { IngredientDialog } from './components/IngredientDialog'
export { IngredientTable } from './components/IngredientTable'
export { IngredientPicker } from './components/IngredientPicker'
export { SelectField } from './components/SelectField'

export { useIngredientList } from './hooks/useIngredientList'
export type { IngredientList, IngredientListState } from './hooks/useIngredientList'
export { useRecipeEditor } from './hooks/useRecipeEditor'
export type { RecipeEditor as RecipeEditorState, RecipeDraft, DraftLine } from './hooks/useRecipeEditor'
export { useShoppingList } from './hooks/useShoppingList'
export type { ShoppingListState, PlannedRow } from './hooks/useShoppingList'

export {
  formatMoney,
  formatCents,
  formatQuantity,
  formatBasisPoints,
  toInputDecimal,
  fromInputDecimal,
} from './lib/format'
export { readErrorCode, readErrorDetails } from './lib/apiError'

export { resolveRecipesMessages, DEFAULT_RECIPES_LOCALE } from './locales'
export type { RecipesMessages, RecipesLocale } from './locales'
