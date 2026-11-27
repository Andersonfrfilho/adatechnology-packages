/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida, no molde de `coupon-contracts/src/errors.ts`: o `module-http` reconhece
 * pela forma (`statusCode`, `code`), sem depender do `DomainError` do host.
 */

export class RecipeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    /** Seguro para o cliente: o `module-http` devolve em `error.details`. */
    public readonly publicDetails?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = 'RecipeError'
  }
}

export const RECIPE_ERROR_CODES = {
  INGREDIENT_NOT_FOUND: 'RECIPE_INGREDIENT_NOT_FOUND',
  RECIPE_NOT_FOUND: 'RECIPE_NOT_FOUND',
  INGREDIENT_IN_USE: 'RECIPE_INGREDIENT_IN_USE',
  UNIT_CHANGE_IN_USE: 'RECIPE_UNIT_CHANGE_IN_USE',
  INCOMPATIBLE_UNIT: 'RECIPE_INCOMPATIBLE_UNIT',
  UNKNOWN_INGREDIENTS: 'RECIPE_UNKNOWN_INGREDIENTS',
  UNKNOWN_PRODUCTS: 'RECIPE_UNKNOWN_PRODUCTS',
  CONFIG_MISSING: 'RECIPE_CONFIG_MISSING',
  UNAUTHENTICATED: 'RECIPE_UNAUTHENTICATED',
} as const
export type RecipeErrorCode = (typeof RECIPE_ERROR_CODES)[keyof typeof RECIPE_ERROR_CODES]

export class IngredientNotFoundError extends RecipeError {
  constructor(ingredientId: string) {
    super('Insumo não encontrado.', 404, RECIPE_ERROR_CODES.INGREDIENT_NOT_FOUND, { ingredientId })
    this.name = 'IngredientNotFoundError'
  }
}

export class RecipeNotFoundError extends RecipeError {
  constructor(productId: string) {
    super('Ficha técnica não encontrada.', 404, RECIPE_ERROR_CODES.RECIPE_NOT_FOUND, { productId })
    this.name = 'RecipeNotFoundError'
  }
}

/** Apagar insumo usado em ficha mudaria o custo dela sem ninguém ver: recusa e diz onde está. */
export class IngredientInUseError extends RecipeError {
  constructor(params: { readonly ingredientId: string; readonly productIds: readonly string[] }) {
    super('O insumo está em uso em fichas técnicas.', 409, RECIPE_ERROR_CODES.INGREDIENT_IN_USE, params, {
      productIds: params.productIds,
    })
    this.name = 'IngredientInUseError'
  }
}

/** Trocar kg por un num insumo usado deixaria as linhas sem conversão possível. */
export class UnitChangeInUseError extends RecipeError {
  constructor(params: { readonly ingredientId: string; readonly productIds: readonly string[] }) {
    super(
      'A nova unidade não converte das linhas que usam o insumo.',
      409,
      RECIPE_ERROR_CODES.UNIT_CHANGE_IN_USE,
      params,
      { productIds: params.productIds },
    )
    this.name = 'UnitChangeInUseError'
  }
}

export type LineUnitIssue = {
  readonly index: number
  readonly ingredientId: string
  readonly unit: string
  readonly ingredientUnit: string
}

export class IncompatibleUnitError extends RecipeError {
  constructor(issues: readonly LineUnitIssue[]) {
    super(
      'Unidade da linha não converte para a do insumo.',
      422,
      RECIPE_ERROR_CODES.INCOMPATIBLE_UNIT,
      { issues },
      {
        issues,
      },
    )
    this.name = 'IncompatibleUnitError'
  }
}

export class UnknownIngredientsError extends RecipeError {
  constructor(ingredientIds: readonly string[]) {
    super(
      'Insumos inexistentes na ficha.',
      422,
      RECIPE_ERROR_CODES.UNKNOWN_INGREDIENTS,
      { ingredientIds },
      {
        ingredientIds,
      },
    )
    this.name = 'UnknownIngredientsError'
  }
}

export class UnknownProductsError extends RecipeError {
  constructor(productIds: readonly string[]) {
    super(
      'Produto inexistente no catálogo da empresa.',
      422,
      RECIPE_ERROR_CODES.UNKNOWN_PRODUCTS,
      { productIds },
      {
        productIds,
      },
    )
    this.name = 'UnknownProductsError'
  }
}

export class RecipeConfigMissingError extends RecipeError {
  constructor(field: string) {
    super(`Configuração ausente: ${field}.`, 500, RECIPE_ERROR_CODES.CONFIG_MISSING, { field })
    this.name = 'RecipeConfigMissingError'
  }
}

export class RecipeUnauthenticatedError extends RecipeError {
  constructor() {
    super('Rota exige contexto autenticado.', 401, RECIPE_ERROR_CODES.UNAUTHENTICATED)
    this.name = 'RecipeUnauthenticatedError'
  }
}
