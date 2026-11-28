/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Unidades e conversão entre as compatíveis (massa com massa, volume com volume, contagem com
 * contagem). O fator é inteiro na menor unidade da dimensão, então converter é exato.
 */

import { divide, multiply, rational, type Rational } from './decimal'

export const RECIPE_UNIT = {
  MILLIGRAM: 'mg',
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  UNIT: 'un',
  DOZEN: 'dz',
} as const
export type RecipeUnit = (typeof RECIPE_UNIT)[keyof typeof RECIPE_UNIT]
export const RECIPE_UNITS = Object.values(RECIPE_UNIT) as readonly RecipeUnit[]

export const UNIT_DIMENSION = { MASS: 'mass', VOLUME: 'volume', COUNT: 'count' } as const
export type UnitDimension = (typeof UNIT_DIMENSION)[keyof typeof UNIT_DIMENSION]

const UNIT_DEFINITIONS: Readonly<Record<RecipeUnit, { dimension: UnitDimension; factor: bigint }>> = {
  mg: { dimension: UNIT_DIMENSION.MASS, factor: 1n },
  g: { dimension: UNIT_DIMENSION.MASS, factor: 1_000n },
  kg: { dimension: UNIT_DIMENSION.MASS, factor: 1_000_000n },
  ml: { dimension: UNIT_DIMENSION.VOLUME, factor: 1n },
  l: { dimension: UNIT_DIMENSION.VOLUME, factor: 1_000n },
  un: { dimension: UNIT_DIMENSION.COUNT, factor: 1n },
  dz: { dimension: UNIT_DIMENSION.COUNT, factor: 12n },
}

export function isRecipeUnit(value: string): value is RecipeUnit {
  return (RECIPE_UNITS as readonly string[]).includes(value)
}

export function unitDimension(unit: RecipeUnit): UnitDimension {
  return UNIT_DEFINITIONS[unit].dimension
}

export function areUnitsCompatible(left: RecipeUnit, right: RecipeUnit): boolean {
  return unitDimension(left) === unitDimension(right)
}

/** Unidades em que uma linha pode ser escrita para um insumo nesta unidade. */
export function compatibleUnits(unit: RecipeUnit): readonly RecipeUnit[] {
  return RECIPE_UNITS.filter((candidate) => areUnitsCompatible(candidate, unit))
}

export type ConvertQuantityParams = {
  readonly quantity: Rational
  readonly from: RecipeUnit
  readonly to: RecipeUnit
}

/** `undefined` quando as dimensões não batem: quem chama decide se é erro. */
export function convertQuantity(params: ConvertQuantityParams): Rational | undefined {
  if (!areUnitsCompatible(params.from, params.to)) return undefined
  const ratio = divide(rational(UNIT_DEFINITIONS[params.from].factor), rational(UNIT_DEFINITIONS[params.to].factor))
  return multiply(params.quantity, ratio)
}
