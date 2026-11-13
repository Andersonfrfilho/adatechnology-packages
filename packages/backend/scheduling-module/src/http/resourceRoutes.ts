/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de recurso agendável. Handler recebe contexto já validado e autenticado por
 * `dispatchRoute` — daí não haver `try/catch` nem checagem de escopo aqui dentro.
 */

import {
  createResourceSchema,
  listResourcesQuerySchema,
  updateResourceSchema,
  type CreateResourceInput,
  type ResourceKind,
  type UpdateResourceInput,
} from '@adatechnology/scheduling-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { SchedulingModule } from '../SchedulingModule'
import { requireCompany } from './requireCompany'

export function buildResourceRoutes(module: SchedulingModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'GET',
      path: '/resources',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      querySchema: listResourcesQuerySchema,
      operationId: 'listResources',
      summary: 'Lista recursos da empresa, paginado',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as {
          page: number
          pageSize: number
          kind?: ResourceKind
          active?: boolean
        }

        const result = await useCases.listResources.execute({ companyId, ...query })
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
      path: '/resources',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: createResourceSchema,
      operationId: 'createResource',
      summary: 'Cadastra um recurso agendável',
      async handler(context) {
        const companyId = requireCompany(context)
        const resource = await useCases.createResource.execute({
          companyId,
          input: context.body as CreateResourceInput,
        })
        return { kind: 'json', status: 201, body: { data: resource } }
      },
    },

    {
      method: 'GET',
      path: '/resources/:id',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'getResource',
      summary: 'Detalhe de um recurso',
      async handler(context) {
        const companyId = requireCompany(context)
        const resource = await useCases.getResource.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: resource } }
      },
    },

    {
      method: 'PUT',
      path: '/resources/:id',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: updateResourceSchema,
      operationId: 'updateResource',
      summary: 'Atualiza um recurso',
      async handler(context) {
        const companyId = requireCompany(context)
        const resource = await useCases.updateResource.execute({
          companyId,
          id: context.params.id ?? '',
          input: context.body as UpdateResourceInput,
        })
        return { kind: 'json', status: 200, body: { data: resource } }
      },
    },

    {
      method: 'DELETE',
      path: '/resources/:id',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'deleteResource',
      summary: 'Remove um recurso (soft delete)',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.deleteResource.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
