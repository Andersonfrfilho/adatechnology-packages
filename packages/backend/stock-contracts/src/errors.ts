/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export class StockError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    public readonly publicDetails?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = 'StockError'
  }
}

export const STOCK_ERROR_CODES = {
  DISABLED: 'STOCK_DISABLED',
  INGREDIENT_NOT_FOUND: 'STOCK_INGREDIENT_NOT_FOUND',
  BATCH_NOT_FOUND: 'STOCK_BATCH_NOT_FOUND',
  INCOMPATIBLE_UNIT: 'STOCK_INCOMPATIBLE_UNIT',
  INSUFFICIENT_BATCH: 'STOCK_INSUFFICIENT_BATCH',
  INVENTORY_NOT_FOUND: 'STOCK_INVENTORY_NOT_FOUND',
  INVENTORY_CLOSED: 'STOCK_INVENTORY_CLOSED',
  INVENTORY_ALREADY_OPEN: 'STOCK_INVENTORY_ALREADY_OPEN',
  CONFIG_MISSING: 'STOCK_CONFIG_MISSING',
  UNAUTHENTICATED: 'STOCK_UNAUTHENTICATED',
} as const

/** Estoque desligado para a empresa: o módulo é opcional e a resposta é a de recurso inexistente. */
export class StockDisabledError extends StockError {
  constructor() {
    super('Estoque não habilitado para a empresa.', 404, STOCK_ERROR_CODES.DISABLED)
    this.name = 'StockDisabledError'
  }
}

export class StockIngredientNotFoundError extends StockError {
  constructor(ingredientId: string) {
    super('Insumo não encontrado.', 404, STOCK_ERROR_CODES.INGREDIENT_NOT_FOUND, { ingredientId })
    this.name = 'StockIngredientNotFoundError'
  }
}

export class StockBatchNotFoundError extends StockError {
  constructor(batchId: string) {
    super('Lote não encontrado.', 404, STOCK_ERROR_CODES.BATCH_NOT_FOUND, { batchId })
    this.name = 'StockBatchNotFoundError'
  }
}

export class StockIncompatibleUnitError extends StockError {
  constructor(params: { readonly unit: string; readonly ingredientUnit: string }) {
    super('Unidade não converte para a do insumo.', 422, STOCK_ERROR_CODES.INCOMPATIBLE_UNIT, params, params)
    this.name = 'StockIncompatibleUnitError'
  }
}

export class InsufficientBatchError extends StockError {
  constructor(params: { readonly batchId: string; readonly remainingQuantity: string }) {
    super('O lote não tem essa quantidade.', 422, STOCK_ERROR_CODES.INSUFFICIENT_BATCH, params, params)
    this.name = 'InsufficientBatchError'
  }
}

export class InventoryNotFoundError extends StockError {
  constructor(inventoryId: string) {
    super('Inventário não encontrado.', 404, STOCK_ERROR_CODES.INVENTORY_NOT_FOUND, { inventoryId })
    this.name = 'InventoryNotFoundError'
  }
}

export class InventoryClosedError extends StockError {
  constructor(inventoryId: string) {
    super('Inventário já aplicado ou cancelado.', 409, STOCK_ERROR_CODES.INVENTORY_CLOSED, { inventoryId })
    this.name = 'InventoryClosedError'
  }
}

/** Dois inventários abertos ao mesmo tempo aplicariam o mesmo ajuste duas vezes. */
export class InventoryAlreadyOpenError extends StockError {
  constructor(inventoryId: string) {
    super(
      'Já existe um inventário aberto.',
      409,
      STOCK_ERROR_CODES.INVENTORY_ALREADY_OPEN,
      { inventoryId },
      { inventoryId },
    )
    this.name = 'InventoryAlreadyOpenError'
  }
}

export class StockConfigMissingError extends StockError {
  constructor(field: string) {
    super(`Configuração ausente: ${field}.`, 500, STOCK_ERROR_CODES.CONFIG_MISSING, { field })
    this.name = 'StockConfigMissingError'
  }
}

export class StockUnauthenticatedError extends StockError {
  constructor() {
    super('Rota exige contexto autenticado.', 401, STOCK_ERROR_CODES.UNAUTHENTICATED)
    this.name = 'StockUnauthenticatedError'
  }
}
