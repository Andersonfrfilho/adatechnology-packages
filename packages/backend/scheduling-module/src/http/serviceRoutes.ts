/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de serviço e vínculo com recurso. Handler recebe contexto já validado e autenticado por
 * `dispatchRoute` — daí não haver `try/catch` nem checagem de escopo aqui dentro.
 */

import {
  createServiceSchema,
  listServicesQuerySchema,
  updateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
} from '@adatechnology/scheduling-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { SchedulingModule } from '../SchedulingModule'
import { requireCompany } from './requireCompany'

export function buildServiceRoutes(module: SchedulingModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'GET',
      path: '/services',
      scope: 'admin',
      querySchema: listServicesQuerySchema,
      operationId: 'listServices',
      summary: 'Lista serviços da empresa, paginado',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as { page: number; pageSize: number; active?: boolean }

        const result = await useCases.listServices.execute({ companyId, ...query })
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
      path: '/services',
      scope: 'admin',
      bodySchema: createServiceSchema,
      operationId: 'createService',
      summary: 'Cadastra um serviço',
      async handler(context) {
        const companyId = requireCompany(context)
        const service = await useCases.createService.execute({
          companyId,
          input: context.body as CreateServiceInput,
        })
        return { kind: 'json', status: 201, body: { data: service } }
      },
    },

    {
      method: 'GET',
      path: '/services/:id',
      scope: 'admin',
      operationId: 'getService',
      summary: 'Detalhe de um serviço',
      async handler(context) {
        const companyId = requireCompany(context)
        const service = await useCases.getService.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: service } }
      },
    },

    {
      method: 'PUT',
      path: '/services/:id',
      scope: 'admin',
      bodySchema: updateServiceSchema,
      operationId: 'updateService',
      summary: 'Atualiza um serviço',
      async handler(context) {
        const companyId = requireCompany(context)
        const service = await useCases.updateService.execute({
          companyId,
          id: context.params.id ?? '',
          input: context.body as UpdateServiceInput,
        })
        return { kind: 'json', status: 200, body: { data: service } }
      },
    },

    {
      method: 'DELETE',
      path: '/services/:id',
      scope: 'admin',
      operationId: 'deleteService',
      summary: 'Remove um serviço (soft delete)',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.deleteService.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },

    {
      method: 'PUT',
      path: '/services/:id/resources/:resourceId',
      scope: 'admin',
      operationId: 'linkResourceToService',
      summary: 'Vincula um recurso a um serviço',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.linkResourceToService.execute({
          companyId,
          serviceId: context.params.id ?? '',
          resourceId: context.params.resourceId ?? '',
        })
        return { kind: 'empty', status: 204 }
      },
    },

    {
      method: 'DELETE',
      path: '/services/:id/resources/:resourceId',
      scope: 'admin',
      operationId: 'unlinkResourceFromService',
      summary: 'Desvincula um recurso de um serviço',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.unlinkResourceFromService.execute({
          companyId,
          serviceId: context.params.id ?? '',
          resourceId: context.params.resourceId ?? '',
        })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
