/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de reserva. Handler recebe contexto já validado e autenticado por `dispatchRoute` — daí
 * não haver `try/catch` nem checagem de escopo aqui dentro. `Idempotency-Key` viaja em header,
 * nunca no corpo (`apis.md`).
 */

import {
  cancelBookingSchema,
  listBookingsQuerySchema,
  requestBookingSchema,
  rescheduleBookingSchema,
  type BookingStatus,
  type CancelBookingInput,
  type RequestBookingInput,
  type RescheduleBookingInput,
} from '@adatechnology/scheduling-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { SchedulingModule } from '../SchedulingModule'
import { requireCompany } from './requireCompany'

export function buildBookingRoutes(module: SchedulingModule): ModuleRoute[] {
  const { useCases } = module

  const syncCalendarRoute: ModuleRoute[] = module.hasCalendarSync
    ? [
        {
          method: 'POST',
          path: '/bookings/:id/sync-calendar',
          scope: 'admin',
          requiredScopes: ['scheduling:admin'],
          operationId: 'syncBookingCalendar',
          summary: 'Refaz o espelho de uma reserva no calendário externo agora',
          async handler(context) {
            const companyId = requireCompany(context)
            const result = await useCases.syncBookingCalendar.execute({ companyId, id: context.params.id ?? '' })
            return { kind: 'json', status: 200, body: { data: result } }
          },
        },
      ]
    : []

  return [
    {
      method: 'GET',
      path: '/bookings',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      querySchema: listBookingsQuerySchema,
      operationId: 'listBookings',
      summary: 'Lista reservas da empresa, paginado e filtrável',
      async handler(context) {
        const companyId = requireCompany(context)
        const query = context.query as unknown as {
          page: number
          pageSize: number
          resourceId?: string
          status?: BookingStatus[]
          from?: Date
          until?: Date
        }

        const result = await useCases.listBookings.execute({ companyId, ...query })
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
      path: '/bookings',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: requestBookingSchema,
      operationId: 'requestBooking',
      summary: 'Solicita uma reserva — agendamento de serviço ou reunião, conforme resourceIds',
      async handler(context) {
        const companyId = requireCompany(context)
        const idempotencyKey = context.headers['idempotency-key']
        const { created, ...result } = await useCases.requestBooking.execute({
          companyId,
          ...(idempotencyKey ? { idempotencyKey } : {}),
          input: context.body as RequestBookingInput,
        })
        return { kind: 'json', status: created ? 201 : 200, body: { data: result } }
      },
    },

    {
      method: 'GET',
      path: '/bookings/:id',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'getBooking',
      summary: 'Detalhe de uma reserva com seus slots',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.getBooking.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/bookings/:id/confirm',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'confirmBooking',
      summary: 'Confirma uma reserva pendente',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.confirmBooking.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'PUT',
      path: '/bookings/:id/reschedule',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: rescheduleBookingSchema,
      operationId: 'rescheduleBooking',
      // PUT e não POST: substitui a faixa de horário inteira — repetir a mesma chamada não muda
      // o resultado (`apis.md`, idempotência).
      summary: 'Remarca uma reserva para uma nova faixa de horário',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.rescheduleBooking.execute({
          companyId,
          id: context.params.id ?? '',
          input: context.body as RescheduleBookingInput,
        })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/bookings/:id/cancel',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      bodySchema: cancelBookingSchema,
      operationId: 'cancelBooking',
      summary: 'Cancela uma reserva',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.cancelBooking.execute({
          companyId,
          id: context.params.id ?? '',
          input: context.body as CancelBookingInput,
        })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/bookings/:id/complete',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'completeBooking',
      summary: 'Marca uma reserva como concluída',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.completeBooking.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/bookings/:id/no-show',
      scope: 'admin',
      requiredScopes: ['scheduling:admin'],
      operationId: 'markBookingNoShow',
      summary: 'Marca uma reserva como não comparecimento',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.markNoShow.execute({ companyId, id: context.params.id ?? '' })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    ...syncCalendarRoute,
  ]
}
