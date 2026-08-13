/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de produto e estoque. Handler recebe contexto já validado e autenticado por
 * `dispatchRoute` — daí não haver `try/catch` nem checagem de escopo aqui dentro.
 */

import { createProductSchema, listProductsQuerySchema, updateProductSchema } from '@adatechnology/catalog-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'
import { z } from 'zod'

import type { CatalogModule } from '../CatalogModule'
import { requireCompany } from './requireCompany'

const adjustInventorySchema = z.object({
  // `null` é valor legítimo: significa "parar de controlar estoque deste item", diferente de 0.
  inventory: z.number().int().min(0).nullable(),
})

const bulkImportSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(10_000),
})

export function buildProductRoutes(module: CatalogModule): ModuleRoute[] {
  const { useCases } = module

  const imageRoutes: ModuleRoute[] = module.hasImageStorage
    ? [
        {
          method: 'POST',
          path: '/products/images',
          scope: 'admin',
          operationId: 'uploadProductImage',
          summary: 'Envia a imagem de um produto e devolve a URL publicada',
          // Sem `bodySchema`: o corpo são os bytes da imagem, e o `Content-Type` diz o formato.
          // Base64 num JSON inflaria 33% do tráfego, e multipart exigiria um parser só para isto.
          async handler(context) {
            const companyId = requireCompany(context)
            const result = await useCases.uploadProductImage.execute({
              companyId,
              bytes: context.rawBody ?? new Uint8Array(),
              mimeType: context.headers['content-type'] ?? '',
            })
            return { kind: 'json', status: 201, body: { data: result } }
          },
        },
      ]
    : []

  return [
    // Antes de `/products/:id` pelo mesmo motivo do `bulk-import`: `findRoute` para na primeira
    // rota que casa, e `:id` casaria "images".
    ...imageRoutes,
    {
      method: 'GET',
      path: '/products',
      scope: 'admin',
      querySchema: listProductsQuerySchema,
      operationId: 'listProducts',
      summary: 'Lista produtos da empresa, paginado',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as {
          page: number
          pageSize: number
          search?: string
          catalogId?: string
          sectionId?: string
          active?: boolean
          syncStatus?: string
        }

        const result = await useCases.listProducts.execute({ companyId, ...query })
        return {
          kind: 'json',
          status: 200,
          body: {
            data: result.data,
            pagination: {
              total: result.total,
              page: result.page,
              pageSize: result.pageSize,
              totalPages: result.totalPages,
            },
          },
        }
      },
    },

    // Declarada ANTES de `/products/:id` porque ambas casam `POST /products/bulk-import` se a
    // ordem inverter — `findRoute` devolve a primeira que casa.
    {
      method: 'POST',
      path: '/products/bulk-import',
      scope: 'admin',
      bodySchema: bulkImportSchema,
      operationId: 'bulkImportProducts',
      summary: 'Importa produtos em lote a partir de linhas já extraídas da planilha',
      async handler(context) {
        const companyId = requireCompany(context)
        const body = context.body as { rows: unknown[] }
        const result = await useCases.bulkImportProducts.execute({ companyId, rows: body.rows })
        // 200 e não 201: a importação é parcial por natureza, e o corpo é o relatório — dizer
        // "criado" quando 40 linhas falharam seria mentira.
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/products',
      scope: 'admin',
      bodySchema: createProductSchema,
      operationId: 'createProduct',
      summary: 'Cadastra um produto',
      async handler(context) {
        const companyId = requireCompany(context)
        const product = await useCases.createProduct.execute({
          companyId,
          ...(context.body as { name: string; priceInCents: number }),
        })
        return { kind: 'json', status: 201, body: { data: product } }
      },
    },

    {
      method: 'GET',
      path: '/products/:id',
      scope: 'admin',
      operationId: 'getProduct',
      summary: 'Detalhe de um produto',
      async handler(context) {
        const companyId = requireCompany(context)
        const product = await useCases.getProduct.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: product } }
      },
    },

    {
      method: 'PUT',
      path: '/products/:id',
      scope: 'admin',
      bodySchema: updateProductSchema,
      operationId: 'updateProduct',
      summary: 'Atualiza um produto',
      async handler(context) {
        const companyId = requireCompany(context)
        const product = await useCases.updateProduct.execute({
          companyId,
          id: context.params.id ?? '',
          ...(context.body as object),
        })
        return { kind: 'json', status: 200, body: { data: product } }
      },
    },

    {
      method: 'DELETE',
      path: '/products/:id',
      scope: 'admin',
      operationId: 'deleteProduct',
      summary: 'Remove um produto (soft delete)',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.deleteProduct.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },

    {
      method: 'PUT',
      path: '/products/:id/inventory',
      scope: 'admin',
      bodySchema: adjustInventorySchema,
      operationId: 'adjustProductInventory',
      // PUT e não POST: o ajuste é absoluto ("tenho 12"), e portanto idempotente — repetir a
      // mesma chamada não muda o resultado (`apis.md`, idempotência).
      summary: 'Define o estoque de um produto (absoluto, não incremental)',
      async handler(context) {
        const companyId = requireCompany(context)
        const body = context.body as { inventory: number | null }
        const product = await useCases.adjustInventory.execute({
          companyId,
          productId: context.params.id ?? '',
          inventory: body.inventory,
        })
        return { kind: 'json', status: 200, body: { data: product } }
      },
    },
  ]
}
