/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. Regra que atravessa todos: **`companyId` nunca vem do corpo da
 * requisição** — é derivado do contexto autenticado (`database.md`, "Consistência e
 * multiempresa"). Aceitá-lo aqui entregaria o isolamento multiempresa ao cliente.
 */

import { z } from 'zod'

import { BOOKING_PARTICIPANT_ROLE, RESOURCE_KIND } from './scheduling.types'

const MAX_PAGE_SIZE = 100
const MAX_PRICE_IN_CENTS = 100_000_000 // R$ 1.000.000,00 — teto de sanidade, não regra de negócio

/**
 * IANA timezone **validada** — `z.string()` solto só apareceria como bug no cálculo de
 * disponibilidade, semanas depois (T1.2). `Intl.supportedValuesOf` é o catálogo real do runtime,
 * não uma lista mantida à mão que fica desatualizada.
 */
export const ianaTimezoneSchema = z.string().refine(
  (value) => Intl.supportedValuesOf('timeZone').includes(value),
  (value) => ({ message: `"${value}" não é um fuso IANA reconhecido.` }),
)

/** `HH:mm`, 00–23 e 00–59 — hora de parede, nunca convertida para UTC no cadastro (spec §5.3). */
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const priceInCents = z.number().int().min(0).max(MAX_PRICE_IN_CENTS)

const timeRangeSchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((range) => range.end > range.start, { message: 'O fim deve ser depois do início.' })

export const createResourceSchema = z.object({
  name: z.string().min(1).max(160),
  kind: z.nativeEnum(RESOURCE_KIND),
  timezone: ianaTimezoneSchema,
  externalRef: z.string().min(1).max(160).optional(),
})
export type CreateResourceBody = z.infer<typeof createResourceSchema>

export const updateResourceSchema = createResourceSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateResourceBody = z.infer<typeof updateResourceSchema>

export const createServiceSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  bufferBeforeMinutes: z.number().int().min(0).max(1440).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(1440).optional(),
  priceInCents: priceInCents.optional(),
  requiresConfirmation: z.boolean().optional(),
  minCancellationNoticeMinutes: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
})
export type CreateServiceBody = z.infer<typeof createServiceSchema>

export const updateServiceSchema = createServiceSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateServiceBody = z.infer<typeof updateServiceSchema>

export const createAvailabilityRuleSchema = z.object({
  resourceId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startsAtLocal: localTimeSchema,
  endsAtLocal: localTimeSchema,
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
})
export type CreateAvailabilityRuleBody = z.infer<typeof createAvailabilityRuleSchema>

export const createAvailabilityExceptionSchema = z.object({
  resourceId: z.string().uuid(),
  during: timeRangeSchema,
  kind: z.enum(['block', 'extra']),
  reason: z.string().max(500).optional(),
})
export type CreateAvailabilityExceptionBody = z.infer<typeof createAvailabilityExceptionSchema>

/**
 * `resourceIds` com 1 item é agendamento de serviço; com 2+ é reunião (spec §5.1). Nenhum campo
 * de `Idempotency-Key` aqui — ele viaja em header, nunca no corpo (`apis.md`).
 */
export const requestBookingSchema = z.object({
  title: z.string().min(1).max(200),
  serviceId: z.string().uuid().optional(),
  during: timeRangeSchema,
  resourceIds: z.array(z.string().uuid()).min(1),
  customerRef: z.string().min(1).max(160).optional(),
  organizerRef: z.string().min(1).max(160).optional(),
  notes: z.string().max(2000).optional(),
  participants: z
    .array(
      z.object({
        participantRef: z.string().min(1).max(160),
        resourceId: z.string().uuid().optional(),
        role: z.nativeEnum(BOOKING_PARTICIPANT_ROLE),
      }),
    )
    .optional(),
})
export type RequestBookingBody = z.infer<typeof requestBookingSchema>

export const rescheduleBookingSchema = z.object({
  during: timeRangeSchema,
})
export type RescheduleBookingBody = z.infer<typeof rescheduleBookingSchema>

export const cancelBookingSchema = z.object({
  cancelledBy: z.string().min(1).max(160),
  cancellationReason: z.string().max(500).optional(),
})
export type CancelBookingBody = z.infer<typeof cancelBookingSchema>

/** Query string chega sempre como texto — daí `coerce` e booleano por literal. */
const booleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

export const listResourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  kind: z.nativeEnum(RESOURCE_KIND).optional(),
  active: booleanFromQuery,
})
export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>

export const listServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  active: booleanFromQuery,
})
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  resourceId: z.string().uuid().optional(),
  status: z.enum(['requested', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  from: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>

/** `maxLookaheadDays` da config trava a janela — consulta de anos é varredura acidental (T3.5). */
export const getAvailabilityQuerySchema = z
  .object({
    resourceId: z.string().uuid(),
    serviceId: z.string().uuid(),
    from: z.coerce.date(),
    until: z.coerce.date(),
  })
  .refine((query) => query.until > query.from, { message: 'O fim deve ser depois do início.' })
export type GetAvailabilityQuery = z.infer<typeof getAvailabilityQuerySchema>
