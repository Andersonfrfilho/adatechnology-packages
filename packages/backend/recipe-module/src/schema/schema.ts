/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host.
export const recipesSchema = pgSchema('recipes')

// Quantidade e custo em numeric(14,4): exato, sem ponto flutuante. Unidade em varchar (sem ENUM nativo).
export const ingredients = recipesSchema.table(
  'ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    costPerUnit: numeric('cost_per_unit', { precision: 14, scale: 4 }).notNull().default('0'),
    supplier: varchar('supplier', { length: 160 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ingredients_company_name').on(table.companyId, table.name),
    // Alvo da FK composta das linhas: a linha só aponta para insumo da mesma empresa.
    uniqueIndex('uq_ingredients_company_id').on(table.companyId, table.id),
    check('ingredients_cost_not_negative', sql`"cost_per_unit" >= 0`),
  ],
)

export const recipes = recipesSchema.table(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    productId: varchar('product_id', { length: 128 }).notNull(),
    yieldPortions: numeric('yield_portions', { precision: 14, scale: 4 }).notNull().default('1'),
    preparationTimeMinutes: integer('preparation_time_minutes'),
    instructions: text('instructions').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_recipes_company_product').on(table.companyId, table.productId),
    check('recipes_yield_positive', sql`"yield_portions" > 0`),
    check(
      'recipes_preparation_not_negative',
      sql`"preparation_time_minutes" is null or "preparation_time_minutes" >= 0`,
    ),
  ],
)

export const recipeLines = recipesSchema.table(
  'recipe_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    notes: text('notes'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_recipe_lines_recipe').on(table.recipeId, table.position),
    index('idx_recipe_lines_ingredient').on(table.companyId, table.ingredientId),
    // RESTRICT: apagar insumo em uso é recusado pelo banco também, não só pelo use case.
    foreignKey({
      name: 'recipe_lines_ingredient_fk',
      columns: [table.companyId, table.ingredientId],
      foreignColumns: [ingredients.companyId, ingredients.id],
    }).onDelete('restrict'),
    check('recipe_lines_quantity_positive', sql`"quantity" > 0`),
  ],
)

export type IngredientRow = typeof ingredients.$inferSelect
export type NewIngredientRow = typeof ingredients.$inferInsert
export type RecipeRow = typeof recipes.$inferSelect
export type NewRecipeRow = typeof recipes.$inferInsert
export type RecipeLineRow = typeof recipeLines.$inferSelect
export type NewRecipeLineRow = typeof recipeLines.$inferInsert
