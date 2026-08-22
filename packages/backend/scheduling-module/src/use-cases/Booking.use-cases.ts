/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fase 4 — reservas. `RequestBookingUseCase` cobre os dois cenários (spec §2): `resourceIds` com
 * 1 item é agendamento de serviço, com 2+ é reunião. A constraint `EXCLUDE` no Postgres decide
 * conflito de horário (T4.1/T4.2) — este arquivo nunca reimplementa a checagem em memória.
 */

import {
  BOOKING_STATUS,
  BookingInPastError,
  BookingNotFoundError,
  BookingNotModifiableError,
  CancellationTooLateError,
  ResourceNotFoundError,
  ResourceUnavailableError,
  ServiceNotFoundError,
  ServiceNotOfferedByResourceError,
  type Booking,
  type BookingParticipantRole,
  type BookingSlot,
  type BookingStatus,
  type CancelBookingInput,
  type ListBookingsParams,
  type PaginatedResponse,
  type RequestBookingInput,
  type RescheduleBookingInput,
  type TimeRange,
} from '@adatechnology/scheduling-contracts'

import type { BookingRow, NewBookingSlotRow, ServiceRow } from '../schema/schema'
import { toBooking, toBookingSlot } from '../shared/toContract'
import { computeBlockingWindow } from './availabilitySlicing'
import { errorNameOf, nowOf, runHook, type SchedulingDependencies } from './schedulingModule.types'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

function assertNotInPast(params: { startsAt: Date; now: Date; toleranceMinutes: number }): void {
  const earliestAllowed = new Date(params.now.getTime() - params.toleranceMinutes * 60_000)
  if (params.startsAt < earliestAllowed) throw new BookingInPastError(params.startsAt)
}

// F-019/F-020: `cancelled`, `completed` e `no_show` são finais — sem esta checagem, remarcar uma
// reserva cancelada tenta substituir slots que o cancelamento já apagou (`values([])` do driver
// vira 500 cru), e completar/marcar `no_show` numa reserva cancelada sobrescreve o status sem
// nenhum sinal de que a transição não fazia sentido.
const TERMINAL_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.NO_SHOW,
])

function assertModifiable(existing: BookingRow): void {
  if (TERMINAL_BOOKING_STATUSES.has(existing.status as BookingStatus)) {
    throw new BookingNotModifiableError(existing.id, existing.status)
  }
}

function blockingWindowFor(params: { during: TimeRange; service?: ServiceRow }): TimeRange {
  return computeBlockingWindow({
    during: params.during,
    bufferBeforeMinutes: params.service?.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: params.service?.bufferAfterMinutes ?? 0,
  })
}

async function assertResourcesExist(params: {
  dependencies: SchedulingDependencies
  companyId: string
  resourceIds: readonly string[]
}): Promise<void> {
  const { resources } = params.dependencies.repositories
  const distinctIds = [...new Set(params.resourceIds)]
  await Promise.all(
    distinctIds.map(async (resourceId) => {
      const resource = await resources.findById({ companyId: params.companyId, id: resourceId })
      if (!resource) throw new ResourceNotFoundError(resourceId)
    }),
  )
}

// M-1 (T9.3): `RequestBookingUseCase` gravava direto na base, contornando as checagens de
// elegibilidade que `ListAvailableSlotsUseCase` já faz (recurso inativo, serviço não oferecido
// pelo recurso) — quem lia a agenda via `ListAvailableSlots` nunca via esse horário como livre,
// mas nada impedia reservar assim mesmo chamando `RequestBooking` direto.
async function assertResourcesEligibleForService(params: {
  dependencies: SchedulingDependencies
  companyId: string
  resourceIds: readonly string[]
  service: ServiceRow
}): Promise<void> {
  const { resources, services } = params.dependencies.repositories
  const offeredResourceIds = await services.listResourceIdsForService({
    companyId: params.companyId,
    serviceId: params.service.id,
  })
  const distinctIds = [...new Set(params.resourceIds)]
  await Promise.all(
    distinctIds.map(async (resourceId) => {
      const resource = await resources.findById({ companyId: params.companyId, id: resourceId })
      if (!resource) throw new ResourceNotFoundError(resourceId)
      if (!resource.active) throw new ResourceUnavailableError(resourceId)
      if (!offeredResourceIds.includes(resourceId)) {
        throw new ServiceNotOfferedByResourceError(resourceId, params.service.id)
      }
    }),
  )
}

/**
 * Vídeo nunca bloqueia a reserva (spec §9.6, T4.9): falha de rede ou de outcome `failed` só loga
 * — a reserva já está gravada quando esta função roda. Chamada tanto por `RequestBooking` (reunião
 * ou serviço sem `requiresConfirmation`, nascidos `confirmed`) quanto por `ConfirmBooking`.
 */
async function attachVideoMeeting(params: {
  dependencies: SchedulingDependencies
  companyId: string
  booking: BookingRow
}): Promise<BookingRow> {
  const { videoMeeting, repositories, logger } = params.dependencies
  if (!videoMeeting) return params.booking

  // M-2: capturado antes do `await` — `params.booking` pode ser o mesmo objeto que outra
  // chamada concorrente muta em memória (ver dublê de teste), e ler `.status` depois do
  // round-trip pegaria o valor já alterado, anulando a guarda de `attachProviderFields`.
  const expectedStatus = params.booking.status

  try {
    const outcome = await videoMeeting.createMeeting({
      bookingId: params.booking.id,
      title: params.booking.title,
      startsAt: params.booking.startsAt,
      endsAt: params.booking.endsAt,
    })
    if (outcome.outcome !== 'created') {
      logger?.warn('scheduling.video_meeting_failed', { bookingId: params.booking.id, errorCode: outcome.errorCode })
      return params.booking
    }
    const updated = await repositories.bookings.attachProviderFields({
      companyId: params.companyId,
      id: params.booking.id,
      expectedStatus,
      values: { meetingUrl: outcome.meetingUrl },
    })
    return updated ?? params.booking
  } catch (error) {
    logger?.warn('scheduling.video_meeting_failed', { bookingId: params.booking.id, errorName: errorNameOf(error) })
    return params.booking
  }
}

/**
 * Espelho no calendário externo nunca bloqueia a reserva (spec §8) — mesma postura de
 * `attachVideoMeeting`. Chamada em `RequestBooking`/`ConfirmBooking` (reserva `confirmed`) e em
 * `RescheduleBooking` (o evento espelhado precisa acompanhar o novo horário).
 */
async function attachCalendarSync(params: {
  dependencies: SchedulingDependencies
  companyId: string
  booking: BookingRow
}): Promise<BookingRow> {
  const { calendarSync, repositories, logger } = params.dependencies
  if (!calendarSync) return params.booking

  // M-2: mesma razão de `attachVideoMeeting` — capturar antes do `await` evita ler um
  // `.status` já mutado por escrita concorrente no mesmo objeto.
  const expectedStatus = params.booking.status

  try {
    const outcome = await calendarSync.upsertEvent({
      externalCalendarId: params.booking.externalCalendarId ?? undefined,
      title: params.booking.title,
      startsAt: params.booking.startsAt,
      endsAt: params.booking.endsAt,
      notes: params.booking.notes ?? undefined,
    })
    if (outcome.outcome !== 'synced') {
      logger?.warn('scheduling.calendar_sync_failed', { bookingId: params.booking.id, errorCode: outcome.errorCode })
      return params.booking
    }
    const updated = await repositories.bookings.attachProviderFields({
      companyId: params.companyId,
      id: params.booking.id,
      expectedStatus,
      values: { externalCalendarId: outcome.externalEventId },
    })
    return updated ?? params.booking
  } catch (error) {
    logger?.warn('scheduling.calendar_sync_failed', { bookingId: params.booking.id, errorName: errorNameOf(error) })
    return params.booking
  }
}

/** Remove o espelho externo no cancelamento — melhor esforço, nunca bloqueia (mesma postura acima). */
async function detachCalendarSync(params: {
  dependencies: SchedulingDependencies
  booking: BookingRow
}): Promise<void> {
  const { calendarSync, logger } = params.dependencies
  if (!calendarSync || !params.booking.externalCalendarId) return

  try {
    await calendarSync.deleteEvent(params.booking.externalCalendarId)
  } catch (error) {
    logger?.warn('scheduling.calendar_sync_delete_failed', {
      bookingId: params.booking.id,
      errorName: errorNameOf(error),
    })
  }
}

function resourceIdsOf(slots: readonly { resourceId: string }[]): readonly string[] {
  return slots.map((slot) => slot.resourceId)
}

/** T4.1/T4.3/T4.4/T4.8/T4.9 — cria a reserva; status de nascimento depende de `service.requiresConfirmation`. */
export class RequestBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: {
    companyId: string
    idempotencyKey?: string
    input: RequestBookingInput
  }): Promise<{ booking: Booking; slots: BookingSlot[]; created: boolean }> {
    const { repositories, hooks } = this.dependencies

    if (params.idempotencyKey) {
      const existing = await repositories.bookings.findByIdempotencyKey({
        companyId: params.companyId,
        idempotencyKey: params.idempotencyKey,
      })
      if (existing) {
        const slots = await repositories.bookings.findSlotsByBooking({ bookingId: existing.id })
        return { booking: toBooking(existing, resourceIdsOf(slots)), slots: slots.map(toBookingSlot), created: false }
      }
    }

    const now = nowOf(this.dependencies)
    assertNotInPast({
      startsAt: params.input.during.start,
      now,
      toleranceMinutes: this.dependencies.config.pastBookingToleranceMinutes ?? 0,
    })

    // HIGH-2: `participant.resourceId` é um id livre vindo do cliente e `booking_participants` não
    // carrega `companyId` — sem checar posse aqui, um id de recurso de outra empresa gravava sem
    // erro (a FK só barra id inexistente, não id de outro tenant), e um id inexistente virava
    // `23503` cru na resposta. Junta com `resourceIds` para uma única checagem de existência+posse.
    const participantResourceIds = (params.input.participants ?? [])
      .map((participant) => participant.resourceId)
      .filter((resourceId): resourceId is string => resourceId !== undefined && resourceId !== null)

    await assertResourcesExist({
      dependencies: this.dependencies,
      companyId: params.companyId,
      resourceIds: [...params.input.resourceIds, ...participantResourceIds],
    })

    let service: ServiceRow | undefined
    if (params.input.serviceId) {
      service = await repositories.services.findById({ companyId: params.companyId, id: params.input.serviceId })
      if (!service) throw new ServiceNotFoundError(params.input.serviceId)

      await assertResourcesEligibleForService({
        dependencies: this.dependencies,
        companyId: params.companyId,
        resourceIds: params.input.resourceIds,
        service,
      })
    }

    const status: BookingStatus = service?.requiresConfirmation ? BOOKING_STATUS.REQUESTED : BOOKING_STATUS.CONFIRMED
    const blocking = blockingWindowFor({ during: params.input.during, service })

    const slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>> = params.input.resourceIds.map((resourceId) => ({
      resourceId,
      duringStart: params.input.during.start,
      duringEnd: params.input.during.end,
      blockingStart: blocking.start,
      blockingEnd: blocking.end,
    }))

    const participants = params.input.participants?.map((participant) => ({
      participantRef: participant.participantRef,
      resourceId: participant.resourceId ?? null,
      role: participant.role as BookingParticipantRole,
    }))

    const created = await repositories.bookings.createWithSlots({
      booking: {
        companyId: params.companyId,
        serviceId: params.input.serviceId ?? null,
        title: params.input.title,
        status,
        startsAt: params.input.during.start,
        endsAt: params.input.during.end,
        customerRef: params.input.customerRef ?? null,
        organizerRef: params.input.organizerRef ?? null,
        notes: params.input.notes ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
      },
      slots,
      participants,
    })

    // F-006: perdeu a corrida do `unique` de `Idempotency-Key` — a reserva devolvida é a
    // vencedora, já processada por essa outra requisição. Replay não repete hook nem side effect.
    if (!created.created) {
      return {
        booking: toBooking(created.booking, resourceIdsOf(created.slots)),
        slots: created.slots.map(toBookingSlot),
        created: false,
      }
    }

    await runHook({
      dependencies: this.dependencies,
      name: 'onBookingRequested',
      run: () =>
        hooks?.onBookingRequested?.({
          companyId: params.companyId,
          occurredAt: now,
          bookingId: created.booking.id,
          serviceId: created.booking.serviceId,
          resourceIds: resourceIdsOf(created.slots),
          status,
        }),
    })

    let booking = created.booking
    if (status === BOOKING_STATUS.CONFIRMED) {
      booking = await attachVideoMeeting({ dependencies: this.dependencies, companyId: params.companyId, booking })
      booking = await attachCalendarSync({ dependencies: this.dependencies, companyId: params.companyId, booking })
      await runHook({
        dependencies: this.dependencies,
        name: 'onBookingConfirmed',
        run: () =>
          hooks?.onBookingConfirmed?.({
            companyId: params.companyId,
            occurredAt: now,
            bookingId: booking.id,
            serviceId: booking.serviceId,
            resourceIds: resourceIdsOf(created.slots),
          }),
      })
    }

    return {
      booking: toBooking(booking, resourceIdsOf(created.slots)),
      slots: created.slots.map(toBookingSlot),
      created: true,
    }
  }
}

/** T4.4/T4.9 — transição explícita `requested` → `confirmed`; idempotente fora desse estado. */
export class ConfirmBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    const { repositories, hooks } = this.dependencies

    const existing = await repositories.bookings.findById({ companyId: params.companyId, id: params.id })
    if (!existing) throw new BookingNotFoundError(params.id)

    const slots = await repositories.bookings.findSlotsByBooking({ bookingId: params.id })

    if (existing.status !== BOOKING_STATUS.REQUESTED) {
      return { booking: toBooking(existing, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
    }

    const confirmed = await repositories.bookings.updateStatus({
      companyId: params.companyId,
      id: params.id,
      status: BOOKING_STATUS.CONFIRMED,
    })
    if (!confirmed) throw new BookingNotFoundError(params.id)

    const withVideo = await attachVideoMeeting({
      dependencies: this.dependencies,
      companyId: params.companyId,
      booking: confirmed,
    })
    const withCalendar = await attachCalendarSync({
      dependencies: this.dependencies,
      companyId: params.companyId,
      booking: withVideo,
    })

    await runHook({
      dependencies: this.dependencies,
      name: 'onBookingConfirmed',
      run: () =>
        hooks?.onBookingConfirmed?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          bookingId: withCalendar.id,
          serviceId: withCalendar.serviceId,
          resourceIds: resourceIdsOf(slots),
        }),
    })

    return { booking: toBooking(withCalendar, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
  }
}

/** T4.5/T4.8/F-007 — `rescheduleWithSlotReplace` troca slots e status na mesma transação; a constraint `EXCLUDE` protege o novo horário contra sobreposição. */
export class RescheduleBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: {
    companyId: string
    id: string
    input: RescheduleBookingInput
  }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    const { repositories, hooks } = this.dependencies

    const existing = await repositories.bookings.findById({ companyId: params.companyId, id: params.id })
    if (!existing) throw new BookingNotFoundError(params.id)
    assertModifiable(existing)

    const now = nowOf(this.dependencies)
    assertNotInPast({
      startsAt: params.input.during.start,
      now,
      toleranceMinutes: this.dependencies.config.pastBookingToleranceMinutes ?? 0,
    })

    const previousSlots = await repositories.bookings.findSlotsByBooking({ bookingId: params.id })

    let service: ServiceRow | undefined
    if (existing.serviceId) {
      service = await repositories.services.findById({ companyId: params.companyId, id: existing.serviceId })
    }
    const blocking = blockingWindowFor({ during: params.input.during, service })

    const newSlots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>> = previousSlots.map((slot) => ({
      resourceId: slot.resourceId,
      duringStart: params.input.during.start,
      duringEnd: params.input.during.end,
      blockingStart: blocking.start,
      blockingEnd: blocking.end,
    }))

    const result = await repositories.bookings.rescheduleWithSlotReplace({
      companyId: params.companyId,
      id: params.id,
      status: existing.status,
      startsAt: params.input.during.start,
      endsAt: params.input.during.end,
      slots: newSlots,
    })
    if (!result) throw new BookingNotFoundError(params.id)
    const { booking: updated, slots } = result

    // Só re-sincroniza quem já tinha espelho — remarcar uma `requested` nunca cria evento novo.
    const booking = existing.externalCalendarId
      ? await attachCalendarSync({ dependencies: this.dependencies, companyId: params.companyId, booking: updated })
      : updated

    await runHook({
      dependencies: this.dependencies,
      name: 'onBookingRescheduled',
      run: () =>
        hooks?.onBookingRescheduled?.({
          companyId: params.companyId,
          occurredAt: now,
          bookingId: booking.id,
          serviceId: booking.serviceId,
          resourceIds: resourceIdsOf(slots),
          previousDuring: { start: existing.startsAt, end: existing.endsAt },
          during: params.input.during,
        }),
    })

    return { booking: toBooking(booking, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
  }
}

/** T4.6 — recusa dentro de `minCancellationNoticeMinutes`; `0` desliga a checagem. */
export class CancelBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: {
    companyId: string
    id: string
    input: CancelBookingInput
  }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    const { repositories, hooks } = this.dependencies

    const existing = await repositories.bookings.findById({ companyId: params.companyId, id: params.id })
    if (!existing) throw new BookingNotFoundError(params.id)

    if (existing.status === BOOKING_STATUS.CANCELLED) {
      return { booking: toBooking(existing, []), slots: [] }
    }
    // HIGH-1: só `cancelled` é replay idempotente — `completed`/`no_show` também são finais e
    // caíam direto no fluxo de cancelamento normal, apagando o histórico de atendimento e
    // disparando `onBookingCancelled` sobre uma reserva que já tinha chegado a um estado final.
    assertModifiable(existing)

    const now = nowOf(this.dependencies)

    let minCancellationNoticeMinutes = this.dependencies.config.defaultMinCancellationNoticeMinutes ?? 0
    if (existing.serviceId) {
      const service = await repositories.services.findById({ companyId: params.companyId, id: existing.serviceId })
      if (service) minCancellationNoticeMinutes = service.minCancellationNoticeMinutes
    }

    if (minCancellationNoticeMinutes > 0) {
      const minutesUntilStart = (existing.startsAt.getTime() - now.getTime()) / 60_000
      if (minutesUntilStart < minCancellationNoticeMinutes) {
        throw new CancellationTooLateError(existing.id, minCancellationNoticeMinutes)
      }
    }

    const slots = await repositories.bookings.findSlotsByBooking({ bookingId: params.id })

    const cancelled = await repositories.bookings.cancelWithSlotRelease({
      companyId: params.companyId,
      id: params.id,
      cancelledAt: now,
      cancelledBy: params.input.cancelledBy,
      cancellationReason: params.input.cancellationReason,
    })
    if (!cancelled) throw new BookingNotFoundError(params.id)

    await detachCalendarSync({ dependencies: this.dependencies, booking: cancelled })

    await runHook({
      dependencies: this.dependencies,
      name: 'onBookingCancelled',
      run: () =>
        hooks?.onBookingCancelled?.({
          companyId: params.companyId,
          occurredAt: now,
          bookingId: cancelled.id,
          serviceId: cancelled.serviceId,
          resourceIds: resourceIdsOf(slots),
          cancelledBy: cancelled.cancelledBy ?? params.input.cancelledBy,
          cancellationReason: cancelled.cancellationReason,
        }),
    })

    return { booking: toBooking(cancelled, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
  }
}

type BookingTransitionEvent = {
  readonly companyId: string
  readonly occurredAt: Date
  readonly bookingId: string
  readonly serviceId?: string | null
  readonly resourceIds: readonly string[]
}

async function transitionAndNotify(params: {
  dependencies: SchedulingDependencies
  companyId: string
  id: string
  status: BookingStatus
  hookName: string
  hook?: (event: BookingTransitionEvent) => Promise<void> | void
}): Promise<{ booking: Booking; slots: BookingSlot[] }> {
  const { repositories } = params.dependencies

  const existing = await repositories.bookings.findById({ companyId: params.companyId, id: params.id })
  if (!existing) throw new BookingNotFoundError(params.id)
  assertModifiable(existing)

  const updated = await repositories.bookings.updateStatus({
    companyId: params.companyId,
    id: params.id,
    status: params.status,
  })
  if (!updated) throw new BookingNotFoundError(params.id)

  const slots = await repositories.bookings.findSlotsByBooking({ bookingId: params.id })

  if (params.hook) {
    await runHook({
      dependencies: params.dependencies,
      name: params.hookName,
      run: () =>
        params.hook?.({
          companyId: params.companyId,
          occurredAt: nowOf(params.dependencies),
          bookingId: updated.id,
          serviceId: updated.serviceId,
          resourceIds: resourceIdsOf(slots),
        }),
    })
  }

  return { booking: toBooking(updated, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
}

/** T4.7 — marca a reserva `completed` depois que o horário passou. */
export class CompleteBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    return transitionAndNotify({
      dependencies: this.dependencies,
      companyId: params.companyId,
      id: params.id,
      status: BOOKING_STATUS.COMPLETED,
      hookName: 'onBookingCompleted',
      hook: this.dependencies.hooks?.onBookingCompleted,
    })
  }
}

/** T4.7 — marca a reserva `no_show`. */
export class MarkNoShowUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    return transitionAndNotify({
      dependencies: this.dependencies,
      companyId: params.companyId,
      id: params.id,
      status: BOOKING_STATUS.NO_SHOW,
      hookName: 'onBookingNoShow',
      hook: this.dependencies.hooks?.onBookingNoShow,
    })
  }
}

/** T4.7 — leitura simples de uma reserva com seus slots. */
export class GetBookingUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    const { bookings } = this.dependencies.repositories
    const booking = await bookings.findById({ companyId: params.companyId, id: params.id })
    if (!booking) throw new BookingNotFoundError(params.id)
    const slots = await bookings.findSlotsByBooking({ bookingId: params.id })
    return { booking: toBooking(booking, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
  }
}

/** Trigger manual do espelho de calendário — reusa `attachCalendarSync`; nunca lança em falha do provider (mesma postura). */
export class SyncBookingCalendarUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<{ booking: Booking; slots: BookingSlot[] }> {
    const { repositories } = this.dependencies

    const existing = await repositories.bookings.findById({ companyId: params.companyId, id: params.id })
    if (!existing) throw new BookingNotFoundError(params.id)

    const booking = await attachCalendarSync({
      dependencies: this.dependencies,
      companyId: params.companyId,
      booking: existing,
    })
    const slots = await repositories.bookings.findSlotsByBooking({ bookingId: params.id })

    return { booking: toBooking(booking, resourceIdsOf(slots)), slots: slots.map(toBookingSlot) }
  }
}

/** T4.7 — listagem paginada, filtrável por recurso/status/janela. */
export class ListBookingsUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: ListBookingsParams): Promise<PaginatedResponse<Booking>> {
    const page = params.page ?? DEFAULT_PAGE
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE

    const { bookings } = this.dependencies.repositories
    const { rows, total } = await bookings.list({
      companyId: params.companyId,
      page,
      pageSize,
      resourceId: params.resourceId,
      status: params.status,
      from: params.from,
      until: params.until,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    })

    // M-5 (T9.3): sem isto, `Booking.resourceIds` ficava vazio na listagem — a única leitura que
    // não passava por `findSlotsByBooking` — e o front não tinha como resolver o fuso do recurso
    // para os campos `datetime-local` de remarcação (ver `BookingDrawer.tsx`).
    const slots = await bookings.findSlotsByBookingIds({ bookingIds: rows.map((row) => row.id) })
    const resourceIdsByBooking = new Map<string, string[]>()
    for (const slot of slots) {
      const resourceIds = resourceIdsByBooking.get(slot.bookingId) ?? []
      resourceIds.push(slot.resourceId)
      resourceIdsByBooking.set(slot.bookingId, resourceIds)
    }

    return {
      data: rows.map((row) => toBooking(row, resourceIdsByBooking.get(row.id) ?? [])),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }
}
