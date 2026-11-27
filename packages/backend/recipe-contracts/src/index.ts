/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  DECIMAL_PATTERN,
  DECIMAL_SCALE,
  ROUNDING,
  ZERO,
  ONE,
  rational,
  isDecimalText,
  parseDecimal,
  fromInteger,
  fromCents,
  add,
  subtract,
  multiply,
  divide,
  compare,
  maximum,
  isPositive,
  roundToScale,
  formatDecimal,
  toCents,
  normalizeDecimal,
} from './decimal'
export type { Rational, Rounding } from './decimal'

export {
  RECIPE_UNIT,
  RECIPE_UNITS,
  UNIT_DIMENSION,
  isRecipeUnit,
  unitDimension,
  areUnitsCompatible,
  compatibleUnits,
  convertQuantity,
} from './units'
export type { RecipeUnit, UnitDimension, ConvertQuantityParams } from './units'

export type {
  Ingredient,
  RecipeLine,
  Recipe,
  RecipeLineCost,
  RecipeCost,
  RecipeWithCost,
  RecipeDetail,
  IngredientNeed,
  StockLevel,
  ShoppingListRow,
  ShoppingList,
  Pagination,
  Paginated,
} from './recipe.types'

export {
  RECIPE_LIMITS,
  EXPORT_FORMAT,
  INGREDIENT_SORT_FIELDS,
  decimalSchema,
  positiveDecimalSchema,
  productIdSchema,
  createIngredientSchema,
  updateIngredientSchema,
  listIngredientsQuerySchema,
  exportFormatSchema,
  exportIngredientsQuerySchema,
  recipeLineInputSchema,
  saveRecipeSchema,
  recipeQuerySchema,
  recipeCostsSchema,
  recipesLookupSchema,
  plannedItemSchema,
  shoppingListSchema,
  shoppingListExportSchema,
} from './schemas'
export type {
  ExportFormat,
  IngredientSortField,
  CreateIngredientInput,
  CreateIngredientData,
  UpdateIngredientInput,
  UpdateIngredientData,
  ListIngredientsQuery,
  ExportIngredientsQuery,
  IngredientFilters,
  RecipeLineInput,
  RecipeLineData,
  SaveRecipeInput,
  SaveRecipeData,
  RecipeQuery,
  RecipeCostsInput,
  RecipeCostsData,
  RecipesLookupData,
  PlannedItem,
  ShoppingListInput,
  ShoppingListData,
  ShoppingListExportData,
} from './schemas'

export {
  RecipeError,
  RECIPE_ERROR_CODES,
  IngredientNotFoundError,
  RecipeNotFoundError,
  IngredientInUseError,
  UnitChangeInUseError,
  IncompatibleUnitError,
  UnknownIngredientsError,
  UnknownProductsError,
  RecipeConfigMissingError,
  RecipeUnauthenticatedError,
} from './errors'
export type { RecipeErrorCode, LineUnitIssue } from './errors'

export { DEFAULT_RECIPE_SCOPES } from './providers'
export type {
  LogMeta,
  LoggerPort,
  ClockPort,
  StockLevelPort,
  ProductReferencePort,
  ExportKind,
  ExportedEvent,
  RecipeHooks,
  RecipeScopes,
  RecipeModuleConfig,
} from './providers'

export { calculateRecipeCost, calculateMargin } from './costing'
export type { RecipeCostSource, IngredientCostSource, CalculateRecipeCostParams, MarginResult } from './costing'

export { calculateIngredientNeedsExact, formatIngredientNeeds } from './needs'
export type {
  NeedsRecipeSource,
  NeedsIngredientSource,
  CalculateIngredientNeedsParams,
  ExactIngredientNeed,
  ExactIngredientNeeds,
} from './needs'

export { buildShoppingList, shoppingListTable, sumDecimals, SHOPPING_LIST_HEADERS } from './shoppingList'
export type { BuildShoppingListParams, ShoppingListHeaders } from './shoppingList'

export { buildCsv, buildCsvLine, neutralizeFormula, CSV_BOM, CSV_CONTENT_TYPE } from './spreadsheet/csv'
export { buildXlsx, columnName, XLSX_CONTENT_TYPE } from './spreadsheet/xlsx'
export { buildZip, crc32 } from './spreadsheet/zip'
export type { ZipEntry } from './spreadsheet/zip'
export type { SpreadsheetCell, SpreadsheetTable } from './spreadsheet/spreadsheet.types'
