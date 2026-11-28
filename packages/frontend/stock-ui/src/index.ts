/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { StockProvider, useStockApi, useStockText } from './providers/StockProvider'
export type { StockProviderProps, StockText } from './providers/StockProvider'
export type { StockApi } from './providers/types'

export { StockLevelsWorkspace, levelStatus } from './components/StockLevelsWorkspace'
export { InventoryWorkspace } from './components/InventoryWorkspace'
export { IngredientStockPanel } from './components/IngredientStockPanel'
export type { IngredientStockPanelProps } from './components/IngredientStockPanel'
export { IngredientStockButton } from './components/IngredientStockButton'
export type { IngredientStockButtonProps } from './components/IngredientStockButton'
export { StockMovementForm } from './components/StockMovementForm'
export { BatchesTable, MovementsTable } from './components/StockHistory'

export { maskDate, parseDateInput } from './lib/date'
export { resolveStockMessages } from './locales'
export type { StockMessages, StockLocale } from './locales'
