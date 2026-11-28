/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas do painel (`admin`, escopos de leitura e escrita separados) e de serviço (fichas em lote
 * para o backend do host ou o `stock-module`). `companyId` sai sempre do token.
 */

import {
  createIngredientSchema,
  DEFAULT_RECIPE_SCOPES,
  exportIngredientsQuerySchema,
  IngredientNotFoundError,
  listIngredientsQuerySchema,
  recipeCostsSchema,
  recipeQuerySchema,
  RecipeNotFoundError,
  recipesLookupSchema,
  saveRecipeSchema,
  shoppingListExportSchema,
  shoppingListSchema,
  updateIngredientSchema,
  type CreateIngredientData,
  type ExportIngredientsQuery,
  type ListIngredientsQuery,
  type RecipeCostsData,
  type RecipeQuery,
  type RecipesLookupData,
  type SaveRecipeData,
  type ShoppingListData,
  type ShoppingListExportData,
  type UpdateIngredientData,
} from '@adatechnology/recipe-contracts'
import type { ModuleRoute, ModuleRouteTable, RequestContext } from '@adatechnology/module-http'

import type { RecipeModule } from '../RecipeModule'
import { actorOf, fileResult, json, productIdParam, requireCompany, uuidParam } from './requireCompany'

type RouteAccess = Pick<ModuleRoute, 'scope' | 'requiredScopes'>

export type CreateRecipeRoutesParams = { readonly module: RecipeModule }

const ingredientNotFound = (value: string) => new IngredientNotFoundError(value)
const recipeNotFound = (value: string) => new RecipeNotFoundError(value)

const ingredientId = (context: RequestContext) => uuidParam(context, 'id', ingredientNotFound)
const productId = (context: RequestContext) => productIdParam(context, recipeNotFound)

function buildIngredientRoutes(module: RecipeModule, read: RouteAccess, write: RouteAccess): ModuleRoute[] {
  const { useCases } = module
  return [
    {
      ...read,
      method: 'GET',
      path: '/ingredients',
      querySchema: listIngredientsQuerySchema,
      operationId: 'recipesListIngredients',
      summary: 'Lista insumos (busca, filtro de unidade, ordenação, paginação)',
      handler: async (context) =>
        json(
          200,
          await useCases.listIngredients.execute({
            companyId: requireCompany(context),
            query: context.query as unknown as ListIngredientsQuery,
          }),
        ),
    },
    // Antes de `/ingredients/:id`: o primeiro padrão que casa vence.
    {
      ...read,
      method: 'GET',
      path: '/ingredients/export',
      querySchema: exportIngredientsQuerySchema,
      operationId: 'recipesExportIngredients',
      summary: 'Exporta todos os insumos do filtro (CSV ou XLSX)',
      handler: async (context) =>
        fileResult(
          await useCases.exportIngredients.execute({
            ...actorOf(context),
            query: context.query as unknown as ExportIngredientsQuery,
          }),
        ),
    },
    {
      ...write,
      method: 'POST',
      path: '/ingredients',
      bodySchema: createIngredientSchema,
      operationId: 'recipesCreateIngredient',
      summary: 'Cria insumo',
      handler: async (context) =>
        json(
          201,
          await useCases.createIngredient.execute({ ...actorOf(context), input: context.body as CreateIngredientData }),
        ),
    },
    {
      ...read,
      method: 'GET',
      path: '/ingredients/:id',
      operationId: 'recipesGetIngredient',
      summary: 'Insumo por id',
      handler: async (context) =>
        json(
          200,
          await useCases.getIngredient.execute({ companyId: requireCompany(context), id: ingredientId(context) }),
        ),
    },
    {
      ...write,
      method: 'PATCH',
      path: '/ingredients/:id',
      bodySchema: updateIngredientSchema,
      operationId: 'recipesUpdateIngredient',
      summary: 'Altera insumo (troca de unidade recusada se quebrar fichas)',
      handler: async (context) =>
        json(
          200,
          await useCases.updateIngredient.execute({
            ...actorOf(context),
            id: ingredientId(context),
            input: context.body as UpdateIngredientData,
          }),
        ),
    },
    {
      ...write,
      method: 'DELETE',
      path: '/ingredients/:id',
      operationId: 'recipesRemoveIngredient',
      summary: 'Apaga insumo (recusado se estiver em ficha)',
      handler: async (context) => {
        await useCases.removeIngredient.execute({ ...actorOf(context), id: ingredientId(context) })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}

function buildRecipeRoutes(module: RecipeModule, read: RouteAccess, write: RouteAccess): ModuleRoute[] {
  const { useCases } = module
  return [
    {
      ...read,
      method: 'GET',
      path: '/recipes/:productId',
      querySchema: recipeQuerySchema,
      operationId: 'recipesGetRecipe',
      summary: 'Ficha técnica do produto com custo (e margem, com o preço de venda)',
      handler: async (context) => {
        const query = context.query as unknown as RecipeQuery
        return json(
          200,
          await useCases.getRecipe.execute({
            companyId: requireCompany(context),
            productId: productId(context),
            ...(query.salePriceCents !== undefined ? { salePriceCents: query.salePriceCents } : {}),
          }),
        )
      },
    },
    {
      ...write,
      method: 'PUT',
      path: '/recipes/:productId',
      bodySchema: saveRecipeSchema,
      querySchema: recipeQuerySchema,
      operationId: 'recipesSaveRecipe',
      summary: 'Grava a ficha inteira (rendimento, preparo, instruções e linhas)',
      handler: async (context) => {
        const query = context.query as unknown as RecipeQuery
        return json(
          200,
          await useCases.saveRecipe.execute({
            ...actorOf(context),
            productId: productId(context),
            input: context.body as SaveRecipeData,
            ...(query.salePriceCents !== undefined ? { salePriceCents: query.salePriceCents } : {}),
          }),
        )
      },
    },
    {
      ...write,
      method: 'DELETE',
      path: '/recipes/:productId',
      operationId: 'recipesRemoveRecipe',
      summary: 'Apaga a ficha do produto',
      handler: async (context) => {
        await useCases.removeRecipe.execute({ ...actorOf(context), productId: productId(context) })
        return { kind: 'empty', status: 204 }
      },
    },
    {
      ...read,
      method: 'POST',
      path: '/recipe-costs',
      bodySchema: recipeCostsSchema,
      operationId: 'recipesCalculateCosts',
      summary: 'Custo e margem de vários produtos (lista do catálogo)',
      handler: async (context) =>
        json(
          200,
          await useCases.calculateRecipeCosts.execute({
            companyId: requireCompany(context),
            products: (context.body as RecipeCostsData).products,
          }),
        ),
    },
    {
      ...read,
      method: 'POST',
      path: '/shopping-lists',
      bodySchema: shoppingListSchema,
      operationId: 'recipesBuildShoppingList',
      summary: 'Lista de compras para as quantidades previstas',
      handler: async (context) =>
        json(
          200,
          await useCases.buildShoppingList.execute({
            companyId: requireCompany(context),
            items: (context.body as ShoppingListData).items,
          }),
        ),
    },
    {
      ...read,
      method: 'POST',
      path: '/shopping-lists/export',
      bodySchema: shoppingListExportSchema,
      operationId: 'recipesExportShoppingList',
      summary: 'Exporta a lista de compras (CSV ou XLSX)',
      handler: async (context) => {
        const body = context.body as ShoppingListExportData
        return fileResult(
          await useCases.exportShoppingList.execute({ ...actorOf(context), items: body.items, format: body.format }),
        )
      },
    },
  ]
}

export function createRecipeRoutes(params: CreateRecipeRoutesParams): ModuleRouteTable {
  const scopes = params.module.config.scopes ?? {}
  const readScopes = scopes.read ?? DEFAULT_RECIPE_SCOPES.read
  const writeScopes = scopes.write ?? DEFAULT_RECIPE_SCOPES.write
  // Quem escreve também lê.
  const read = { scope: 'admin' as const, requiredScopes: [...readScopes, ...writeScopes] }
  const write = { scope: 'admin' as const, requiredScopes: [...writeScopes] }
  const service: ModuleRoute = {
    scope: 'service',
    requiredScopes: [...(scopes.service ?? DEFAULT_RECIPE_SCOPES.service)],
    method: 'POST',
    path: '/service/recipes/lookup',
    bodySchema: recipesLookupSchema,
    operationId: 'recipesLookupRecipes',
    summary: 'Fichas e insumos de vários produtos (baixa de estoque, estimativas do host)',
    handler: async (context) =>
      json(
        200,
        await params.module.useCases.lookupRecipes.execute({
          companyId: requireCompany(context),
          productIds: (context.body as RecipesLookupData).productIds,
        }),
      ),
  }
  return [
    ...buildIngredientRoutes(params.module, read, write),
    ...buildRecipeRoutes(params.module, read, write),
    service,
  ]
}
