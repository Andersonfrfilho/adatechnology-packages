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
// Peças base, para telas irmãs (ex.: `stock-ui`) ficarem iguais sem copiar: usam o `RecipesProvider`.
export { Field } from './components/Field'
export type { FieldProps } from './components/Field'
export { Pagination } from './components/Pagination'
export type { PaginationProps } from './components/Pagination'
export { SortHeader } from './components/SortHeader'
export { ConfirmDialog } from './components/ConfirmDialog'
export type { ConfirmDialogProps } from './components/ConfirmDialog'
export { Feedback } from './components/Feedback'
export { useDebouncedValue } from './hooks/useDebouncedValue'
export { useAsyncResource } from './hooks/useAsyncResource'
export type { AsyncResource } from './hooks/useAsyncResource'

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
  formatDateTime,
  toInputDecimal,
  fromInputDecimal,
} from './lib/format'
export { readErrorCode, readErrorDetails } from './lib/apiError'

export { resolveRecipesMessages, DEFAULT_RECIPES_LOCALE } from './locales'
export type { RecipesMessages, RecipesLocale } from './locales'
