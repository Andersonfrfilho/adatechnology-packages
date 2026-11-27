/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas do painel (`admin`: leitura e escrita) e de serviço (baixa por pedido e saldo em lote para
 * o backend do host). `companyId` sai sempre do token.
 */

import {
  adjustStockSchema,
  DEFAULT_STOCK_SCOPES,
  deductOrderSchema,
  InventoryNotFoundError,
  listBatchesQuerySchema,
  listInventoriesQuerySchema,
  listLevelsQuerySchema,
  listMovementsQuerySchema,
  openInventorySchema,
  receiveBatchSchema,
  recordCountsSchema,
  recordLossSchema,
  setMinimumSchema,
  StockIngredientNotFoundError,
  stockLevelsLookupSchema,
  type AdjustStockData,
  type DeductOrderData,
  type ListBatchesQuery,
  type ListInventoriesQuery,
  type ListLevelsQuery,
  type ListMovementsQuery,
  type OpenInventoryData,
  type ReceiveBatchData,
  type RecordCountsData,
  type RecordLossData,
  type SetMinimumData,
  type StockLevelsLookupData,
} from '@adatechnology/stock-contracts'
import type { ModuleRoute, ModuleRouteTable, RequestContext } from '@adatechnology/module-http'

import type { StockModule } from '../StockModule'
import { actorOf, json, requireCompany, uuidParam } from './requireCompany'

type RouteAccess = Pick<ModuleRoute, 'scope' | 'requiredScopes'>

export type CreateStockRoutesParams = { readonly module: StockModule }

const ingredientId = (context: RequestContext) =>
  uuidParam(context, 'ingredientId', (value) => new StockIngredientNotFoundError(value))
const inventoryId = (context: RequestContext) => uuidParam(context, 'id', (value) => new InventoryNotFoundError(value))

function buildLevelRoutes(module: StockModule, read: RouteAccess, write: RouteAccess): ModuleRoute[] {
  const { useCases } = module
  return [
    {
      ...read,
      method: 'GET',
      path: '/levels',
      querySchema: listLevelsQuerySchema,
      operationId: 'stockListLevels',
      summary: 'Saldos por insumo (abaixo do mínimo primeiro)',
      handler: async (context) =>
        json(
          200,
          await useCases.listLevels.execute({
            companyId: requireCompany(context),
            query: context.query as unknown as ListLevelsQuery,
          }),
        ),
    },
    {
      ...read,
      method: 'GET',
      path: '/levels/:ingredientId',
      operationId: 'stockGetLevel',
      summary: 'Saldo de um insumo',
      handler: async (context) =>
        json(
          200,
          await useCases.getLevel.execute({ companyId: requireCompany(context), ingredientId: ingredientId(context) }),
        ),
    },
    {
      ...write,
      method: 'PUT',
      path: '/levels/:ingredientId/minimum',
      bodySchema: setMinimumSchema,
      operationId: 'stockSetMinimum',
      summary: 'Define (ou tira) o estoque mínimo do insumo',
      handler: async (context) =>
        json(
          200,
          await useCases.setMinimum.execute({
            companyId: requireCompany(context),
            ingredientId: ingredientId(context),
            minimumQuantity: (context.body as SetMinimumData).minimumQuantity,
          }),
        ),
    },
    {
      ...write,
      method: 'POST',
      path: '/batches',
      bodySchema: receiveBatchSchema,
      operationId: 'stockReceiveBatch',
      summary: 'Entrada de lote (com validade e custo opcionais)',
      handler: async (context) =>
        json(
          201,
          await useCases.receiveBatch.execute({ ...actorOf(context), input: context.body as ReceiveBatchData }),
        ),
    },
    {
      ...read,
      method: 'GET',
      path: '/batches',
      querySchema: listBatchesQuerySchema,
      operationId: 'stockListBatches',
      summary: 'Lotes (com saldo, vencendo na janela)',
      handler: async (context) =>
        json(
          200,
          await useCases.listBatches.execute({
            companyId: requireCompany(context),
            query: context.query as unknown as ListBatchesQuery,
          }),
        ),
    },
    {
      ...write,
      method: 'POST',
      path: '/adjustments',
      bodySchema: adjustStockSchema,
      operationId: 'stockAdjust',
      summary: 'Ajuste manual com motivo',
      handler: async (context) =>
        json(201, await useCases.adjustStock.execute({ ...actorOf(context), input: context.body as AdjustStockData })),
    },
    {
      ...write,
      method: 'POST',
      path: '/losses',
      bodySchema: recordLossSchema,
      operationId: 'stockRecordLoss',
      summary: 'Perda com motivo (de um lote ou dos que vencem antes)',
      handler: async (context) =>
        json(201, await useCases.recordLoss.execute({ ...actorOf(context), input: context.body as RecordLossData })),
    },
    {
      ...read,
      method: 'GET',
      path: '/movements',
      querySchema: listMovementsQuerySchema,
      operationId: 'stockListMovements',
      summary: 'Movimentos (entrada, saída, ajuste, perda) com motivo e autor',
      handler: async (context) =>
        json(
          200,
          await useCases.listMovements.execute({
            companyId: requireCompany(context),
            query: context.query as unknown as ListMovementsQuery,
          }),
        ),
    },
  ]
}

function buildInventoryRoutes(module: StockModule, read: RouteAccess, write: RouteAccess): ModuleRoute[] {
  const { useCases } = module
  return [
    {
      ...read,
      method: 'GET',
      path: '/inventories',
      querySchema: listInventoriesQuerySchema,
      operationId: 'stockListInventories',
      summary: 'Inventários',
      handler: async (context) =>
        json(
          200,
          await useCases.listInventories.execute({
            companyId: requireCompany(context),
            query: context.query as unknown as ListInventoriesQuery,
          }),
        ),
    },
    {
      ...write,
      method: 'POST',
      path: '/inventories',
      bodySchema: openInventorySchema,
      operationId: 'stockOpenInventory',
      summary: 'Abre um inventário (um aberto por empresa)',
      handler: async (context) =>
        json(
          201,
          await useCases.openInventory.execute({ ...actorOf(context), input: context.body as OpenInventoryData }),
        ),
    },
    {
      ...read,
      method: 'GET',
      path: '/inventories/:id',
      operationId: 'stockGetInventory',
      summary: 'Inventário com as linhas',
      handler: async (context) =>
        json(
          200,
          await useCases.getInventory.execute({ companyId: requireCompany(context), id: inventoryId(context) }),
        ),
    },
    {
      ...write,
      method: 'PUT',
      path: '/inventories/:id/counts',
      bodySchema: recordCountsSchema,
      operationId: 'stockRecordCounts',
      summary: 'Grava contagens (parciais)',
      handler: async (context) =>
        json(
          200,
          await useCases.recordCounts.execute({
            companyId: requireCompany(context),
            id: inventoryId(context),
            input: context.body as RecordCountsData,
          }),
        ),
    },
    {
      ...write,
      method: 'POST',
      path: '/inventories/:id/apply',
      operationId: 'stockApplyInventory',
      summary: 'Aplica: ajusta cada contado contra o saldo do momento',
      handler: async (context) =>
        json(200, await useCases.applyInventory.execute({ ...actorOf(context), id: inventoryId(context) })),
    },
    {
      ...write,
      method: 'POST',
      path: '/inventories/:id/cancel',
      operationId: 'stockCancelInventory',
      summary: 'Cancela o inventário aberto',
      handler: async (context) => {
        await useCases.cancelInventory.execute({ companyId: requireCompany(context), id: inventoryId(context) })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}

function buildServiceRoutes(module: StockModule, service: RouteAccess): ModuleRoute[] {
  const { useCases } = module
  return [
    {
      ...service,
      method: 'POST',
      path: '/service/orders/deductions',
      bodySchema: deductOrderSchema,
      operationId: 'stockDeductOrder',
      summary: 'Baixa por pedido pela ficha (idempotente por linha)',
      handler: async (context) =>
        json(200, await useCases.deductOrder.execute({ ...actorOf(context), input: context.body as DeductOrderData })),
    },
    {
      ...service,
      method: 'POST',
      path: '/service/levels/lookup',
      bodySchema: stockLevelsLookupSchema,
      operationId: 'stockLookupLevels',
      summary: 'Saldo de vários insumos (StockLevelPort por HTTP)',
      handler: async (context) =>
        json(
          200,
          await useCases.getLevels.getLevels({
            companyId: requireCompany(context),
            ingredientIds: (context.body as StockLevelsLookupData).ingredientIds,
          }),
        ),
    },
  ]
}

export function createStockRoutes(params: CreateStockRoutesParams): ModuleRouteTable {
  const scopes = params.module.config.scopes ?? {}
  const writeScopes = scopes.write ?? DEFAULT_STOCK_SCOPES.write
  const read: RouteAccess = {
    scope: 'admin',
    requiredScopes: [...(scopes.read ?? DEFAULT_STOCK_SCOPES.read), ...writeScopes],
  }
  const write: RouteAccess = { scope: 'admin', requiredScopes: [...writeScopes] }
  const service: RouteAccess = {
    scope: 'service',
    requiredScopes: [...(scopes.service ?? DEFAULT_STOCK_SCOPES.service)],
  }
  return [
    ...buildLevelRoutes(params.module, read, write),
    ...buildInventoryRoutes(params.module, read, write),
    ...buildServiceRoutes(params.module, service),
  ]
}
