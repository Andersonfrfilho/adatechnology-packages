/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de grade semanal, exceção e disponibilidade calculada. Handler recebe contexto já
 * validado e autenticado por `dispatchRoute` — daí não haver `try/catch` nem checagem de escopo
 * aqui dentro.
 */

import {
  createAvailabilityExceptionSchema,
  createAvailabilityRuleSchema,
  getAvailabilityQuerySchema,
  type AvailabilityExceptionKind,
  type CreateAvailabilityRuleInput,
  type TimeRange,
} from '@adatechnology/scheduling-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'
import { z } from 'zod'

import type { SchedulingModule } from '../SchedulingModule'
import { requireCompany } from './requireCompany'

const setAvailabilityRulesSchema = z.object({
  // F-015: teto arbitrário mas generoso (7 dias × várias janelas/dia) — sem ele, `rules` sem
  // limite vira `occurrences` sem limite em `resolveLocalInstants` (uma regra por ocorrência de
  // cada dia da janela pedida), estourando o teto de parâmetros do bind do Postgres.
  rules: z.array(createAvailabilityRuleSchema.omit({ resourceId: true })).max(100),
})

const createAvailabilityExceptionBodySchema = createAvailabilityExceptionSchema.omit({ resourceId: true })

export function buildAvailabilityRoutes(module: SchedulingModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'GET',
      path: '/availability',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      querySchema: getAvailabilityQuerySchema,
      operationId: 'listAvailableSlots',
      summary: 'Calcula os horários livres de um recurso para um serviço numa janela',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as {
          resourceId: string
          serviceId: string
          from: Date
          until: Date
        }
        const slots = await useCases.listAvailableSlots.execute({ companyId, ...query })
        return { kind: 'json', status: 200, body: { data: slots } }
      },
    },

    {
      method: 'GET',
      path: '/resources/:id/availability-rules',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'listAvailabilityRules',
      summary: 'Lista a grade semanal vigente de um recurso',
      async handler(context) {
        const companyId = requireCompany(context)
        const rules = await useCases.listAvailabilityRules.execute({
          companyId,
          resourceId: context.params.id ?? '',
        })
        return { kind: 'json', status: 200, body: { data: rules } }
      },
    },

    {
      method: 'PUT',
      path: '/resources/:id/availability-rules',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: setAvailabilityRulesSchema,
      operationId: 'setAvailabilityRules',
      // PUT e não POST: substitui a grade inteira de uma vez — repetir a mesma chamada não muda
      // o resultado (`apis.md`, idempotência).
      summary: 'Substitui a grade semanal inteira de um recurso',
      async handler(context) {
        const companyId = requireCompany(context)
        const body = context.body as { rules: ReadonlyArray<Omit<CreateAvailabilityRuleInput, 'resourceId'>> }
        const rules = await useCases.setAvailabilityRules.execute({
          companyId,
          resourceId: context.params.id ?? '',
          rules: body.rules,
        })
        return { kind: 'json', status: 200, body: { data: rules } }
      },
    },

    {
      method: 'GET',
      path: '/resources/:id/availability-exceptions',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'listAvailabilityExceptions',
      summary: 'Lista as exceções vigentes de um recurso',
      async handler(context) {
        const companyId = requireCompany(context)
        const exceptions = await useCases.listAvailabilityExceptions.execute({
          companyId,
          resourceId: context.params.id ?? '',
        })
        return { kind: 'json', status: 200, body: { data: exceptions } }
      },
    },

    {
      method: 'POST',
      path: '/resources/:id/availability-exceptions',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: createAvailabilityExceptionBodySchema,
      operationId: 'addAvailabilityException',
      summary: 'Adiciona um bloqueio ou encaixe pontual fora da grade semanal',
      async handler(context) {
        const companyId = requireCompany(context)
        const body = context.body as { during: TimeRange; kind: AvailabilityExceptionKind; reason?: string }
        const exception = await useCases.addAvailabilityException.execute({
          companyId,
          input: { resourceId: context.params.id ?? '', ...body },
        })
        return { kind: 'json', status: 201, body: { data: exception } }
      },
    },

    {
      method: 'DELETE',
      path: '/availability-exceptions/:id',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'removeAvailabilityException',
      summary: 'Remove uma exceção de disponibilidade',
      async handler(context) {
        const companyId = requireCompany(context)
        await useCases.removeAvailabilityException.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
