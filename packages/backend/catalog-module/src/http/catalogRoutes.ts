/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  createCatalogSchema,
  createSectionSchema,
  listCatalogsQuerySchema,
  updateCatalogSchema,
  updateSectionSchema,
} from '@adatechnology/catalog-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'
import { requireCompany } from './requireCompany'

export function buildCatalogRoutes(module: CatalogModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'GET',
      path: '/catalogs',
      scope: 'admin',
      querySchema: listCatalogsQuerySchema,
      operationId: 'listCatalogs',
      summary: 'Lista catálogos da empresa, com contagem de produtos',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as { page: number; pageSize: number; search?: string; active?: boolean }
        const result = await useCases.listCatalogs.execute({ companyId, ...query })
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

    {
      method: 'POST',
      path: '/catalogs',
      scope: 'admin',
      bodySchema: createCatalogSchema,
      operationId: 'createCatalog',
      summary: 'Cria um catálogo',
      async handler(context) {
        const companyId = requireCompany(context)
        const catalog = await useCases.createCatalog.execute({ companyId, ...(context.body as { name: string }) })
        return { kind: 'json', status: 201, body: { data: catalog } }
      },
    },

    {
      method: 'PUT',
      path: '/catalogs/:id',
      scope: 'admin',
      bodySchema: updateCatalogSchema,
      operationId: 'updateCatalog',
      summary: 'Atualiza um catálogo',
      async handler(context) {
        const companyId = requireCompany(context)
        const catalog = await useCases.updateCatalog.execute({
          companyId,
          id: context.params.id ?? '',
          ...(context.body as object),
        })
        return { kind: 'json', status: 200, body: { data: catalog } }
      },
    },

    {
      method: 'DELETE',
      path: '/catalogs/:id',
      scope: 'admin',
      operationId: 'deleteCatalog',
      summary: 'Remove um catálogo — recusa se ainda houver produto dentro',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.deleteCatalog.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },

    {
      method: 'GET',
      path: '/sections',
      scope: 'admin',
      operationId: 'listSections',
      summary: 'Lista seções — as do catálogo informado e as globais',
      async handler(context) {
        const companyId = requireCompany(context)
        const sections = await useCases.listSections.execute({ companyId, catalogId: context.query.catalogId })
        return { kind: 'json', status: 200, body: { data: sections } }
      },
    },

    {
      method: 'POST',
      path: '/sections',
      scope: 'admin',
      bodySchema: createSectionSchema,
      operationId: 'createSection',
      summary: 'Cria uma seção',
      async handler(context) {
        const companyId = requireCompany(context)
        const section = await useCases.createSection.execute({ companyId, ...(context.body as { name: string }) })
        return { kind: 'json', status: 201, body: { data: section } }
      },
    },

    {
      method: 'PUT',
      path: '/sections/:id',
      scope: 'admin',
      bodySchema: updateSectionSchema,
      operationId: 'updateSection',
      summary: 'Atualiza uma seção',
      async handler(context) {
        const companyId = requireCompany(context)
        const section = await useCases.updateSection.execute({
          companyId,
          id: context.params.id ?? '',
          ...(context.body as object),
        })
        return { kind: 'json', status: 200, body: { data: section } }
      },
    },

    {
      method: 'DELETE',
      path: '/sections/:id',
      scope: 'admin',
      operationId: 'deleteSection',
      summary: 'Remove uma seção — o produto sobrevive sem ela',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.deleteSection.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
