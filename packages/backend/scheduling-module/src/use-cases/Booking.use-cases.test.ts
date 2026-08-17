/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Comportamento dos use-cases de reserva (Fase 4) contra os dublês em memória. Conflito de horário
 * (`EXCLUDE`, T4.1/T4.2) fica fora daqui de propósito — ver a limitação documentada no topo de
 * `testing/inMemoryRepositories.ts` — e vira teste de integração contra Postgres real.
 */

import { describe, expect, it } from 'bun:test'

import {
  BOOKING_STATUS,
  BOOKING_PARTICIPANT_ROLE,
  BookingInPastError,
  BookingNotFoundError,
  BookingNotModifiableError,
  CancellationTooLateError,
  RESOURCE_KIND,
  ResourceNotFoundError,
  ServiceNotFoundError,
  type CalendarSyncPort,
  type ClockPort,
  type SchedulingHooks,
  type SchedulingModuleConfig,
  type VideoMeetingPort,
} from '@adatechnology/scheduling-contracts'

import type { ResourceRow, ServiceRow } from '../schema/schema'
import {
  createInMemoryBookings,
  createInMemoryResources,
  createInMemoryServices,
} from '../testing/inMemoryRepositories'
import {
  CancelBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  GetBookingUseCase,
  ListBookingsUseCase,
  MarkNoShowUseCase,
  RequestBookingUseCase,
  RescheduleBookingUseCase,
} from './Booking.use-cases'
import type { SchedulingDependencies } from './schedulingModule.types'

const COMPANY_ID = 'company-1'
const NOW = new Date('2026-08-14T12:00:00.000Z')
const FIXED_CLOCK: ClockPort = { now: () => NOW }

function buildDependencies(
  options: {
    config?: Partial<SchedulingModuleConfig>
    hooks?: SchedulingHooks
    videoMeeting?: VideoMeetingPort
    calendarSync?: CalendarSyncPort
    clock?: ClockPort
  } = {},
) {
  const resources = createInMemoryResources()
  const services = createInMemoryServices()
  const bookings = createInMemoryBookings()

  const dependencies = {
    repositories: { resources, services, bookings, availability: {} },
    config: { maxLookaheadDays: 60, ...options.config },
    hooks: options.hooks,
    clock: options.clock ?? FIXED_CLOCK,
    videoMeeting: options.videoMeeting,
    calendarSync: options.calendarSync,
  } as unknown as SchedulingDependencies

  return { dependencies, resources, services, bookings }
}

async function createResource(
  resources: ReturnType<typeof createInMemoryResources>,
  overrides: Partial<Parameters<typeof resources.create>[0]> = {},
): Promise<ResourceRow> {
  return resources.create({
    companyId: COMPANY_ID,
    name: 'Sala 1',
    kind: RESOURCE_KIND.ROOM,
    timezone: 'America/Sao_Paulo',
    ...overrides,
  })
}

async function createService(
  services: ReturnType<typeof createInMemoryServices>,
  overrides: Partial<Parameters<typeof services.create>[0]> = {},
): Promise<ServiceRow> {
  return services.create({
    companyId: COMPANY_ID,
    name: 'Corte de cabelo',
    durationMinutes: 30,
    ...overrides,
  })
}

const FUTURE_START = new Date('2026-08-20T14:00:00.000Z')
const FUTURE_END = new Date('2026-08-20T14:30:00.000Z')

describe('RequestBookingUseCase', () => {
  it('nasce confirmed quando não há serviço com requiresConfirmation', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED)
  })

  it('nasce requested quando o serviço exige confirmação, e já ocupa a agenda', async () => {
    const { dependencies, resources, services, bookings } = buildDependencies()
    const resource = await createResource(resources)
    const service = await createService(services, { requiresConfirmation: true })

    const { booking, slots } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [resource.id],
      },
    })

    expect(booking.status).toBe(BOOKING_STATUS.REQUESTED)
    expect(slots).toHaveLength(1)
    expect(bookings.slotsByBooking.get(booking.id)).toHaveLength(1)
  })

  it('reunião com 2+ recursos grava um slot por recurso', async () => {
    const { dependencies, resources } = buildDependencies()
    const resourceA = await createResource(resources, { name: 'Sala A' })
    const resourceB = await createResource(resources, { name: 'Sala B', kind: RESOURCE_KIND.PERSON })

    const { slots } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Reunião de time',
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [resourceA.id, resourceB.id],
        participants: [
          { participantRef: 'user-1', resourceId: resourceA.id, role: BOOKING_PARTICIPANT_ROLE.ORGANIZER },
          { participantRef: 'user-2', resourceId: resourceB.id, role: BOOKING_PARTICIPANT_ROLE.ATTENDEE },
        ],
      },
    })

    expect(slots.map((slot) => slot.resourceId).sort()).toEqual([resourceA.id, resourceB.id].sort())
  })

  it('recusa recurso inexistente', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new RequestBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: ['missing'] },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('HIGH-2: recusa participant.resourceId que não pertence à empresa', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)
    const otherCompanyResource = await resources.create({
      companyId: 'company-2',
      name: 'Sala de outra empresa',
      kind: RESOURCE_KIND.ROOM,
      timezone: 'America/Sao_Paulo',
    })

    await expect(
      new RequestBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        input: {
          title: 'Reunião',
          during: { start: FUTURE_START, end: FUTURE_END },
          resourceIds: [resource.id],
          participants: [
            { participantRef: 'user-1', resourceId: otherCompanyResource.id, role: BOOKING_PARTICIPANT_ROLE.ATTENDEE },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('recusa serviço inexistente', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    await expect(
      new RequestBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        input: {
          title: 'Corte',
          serviceId: 'missing',
          during: { start: FUTURE_START, end: FUTURE_END },
          resourceIds: [resource.id],
        },
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError)
  })

  it('recusa horário no passado sem tolerância configurada', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)
    const pastStart = new Date(NOW.getTime() - 60 * 60_000)
    const pastEnd = new Date(NOW.getTime() - 30 * 60_000)

    await expect(
      new RequestBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        input: { title: 'Reunião', during: { start: pastStart, end: pastEnd }, resourceIds: [resource.id] },
      }),
    ).rejects.toBeInstanceOf(BookingInPastError)
  })

  it('aceita horário levemente no passado dentro de pastBookingToleranceMinutes', async () => {
    const { dependencies, resources } = buildDependencies({ config: { pastBookingToleranceMinutes: 10 } })
    const resource = await createResource(resources)
    const almostNowStart = new Date(NOW.getTime() - 5 * 60_000)
    const almostNowEnd = new Date(NOW.getTime() + 25 * 60_000)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: almostNowStart, end: almostNowEnd }, resourceIds: [resource.id] },
    })

    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED)
  })

  it('replay pela idempotencyKey devolve a mesma reserva sem criar nova linha', async () => {
    const { dependencies, resources, bookings } = buildDependencies()
    const resource = await createResource(resources)
    const useCase = new RequestBookingUseCase(dependencies)
    const input = { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] }

    const first = await useCase.execute({ companyId: COMPANY_ID, idempotencyKey: 'key-1', input })
    const second = await useCase.execute({ companyId: COMPANY_ID, idempotencyKey: 'key-1', input })

    expect(second.booking.id).toBe(first.booking.id)
    expect(bookings.rows).toHaveLength(1)
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
  })

  it('anexa link de vídeo quando a reserva nasce confirmed', async () => {
    const videoMeeting: VideoMeetingPort = {
      createMeeting: async () => ({ outcome: 'created', meetingUrl: 'https://video.example/room-1' }),
    }
    const { dependencies, resources } = buildDependencies({ videoMeeting })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    expect(booking.meetingUrl).toBe('https://video.example/room-1')
  })

  it('falha do provedor de vídeo não bloqueia a reserva', async () => {
    const videoMeeting: VideoMeetingPort = {
      createMeeting: async () => {
        throw new Error('provedor fora do ar')
      },
    }
    const { dependencies, resources } = buildDependencies({ videoMeeting })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED)
    expect(booking.meetingUrl ?? null).toBeNull()
  })

  it('anexa evento de calendário quando a reserva nasce confirmed', async () => {
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => ({ outcome: 'synced', externalEventId: 'ext-event-1' }),
      deleteEvent: async () => {},
      readEvents: async () => [],
    }
    const { dependencies, resources } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    expect(booking.externalCalendarId).toBe('ext-event-1')
  })

  it('falha do provedor de calendário não bloqueia a reserva', async () => {
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => {
        throw new Error('provedor fora do ar')
      },
      deleteEvent: async () => {},
      readEvents: async () => [],
    }
    const { dependencies, resources } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED)
    expect(booking.externalCalendarId ?? null).toBeNull()
  })

  it('dispara onBookingRequested sempre, e onBookingConfirmed só quando nasce confirmed', async () => {
    const requestedEvents: string[] = []
    const confirmedEvents: string[] = []
    const { dependencies: confirmedDependencies, resources: confirmedResources } = buildDependencies({
      hooks: {
        onBookingRequested: (event) => {
          requestedEvents.push(event.status)
        },
        onBookingConfirmed: (event) => {
          confirmedEvents.push(event.bookingId)
        },
      },
    })
    const confirmedResource = await createResource(confirmedResources)

    await new RequestBookingUseCase(confirmedDependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Reunião',
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [confirmedResource.id],
      },
    })

    expect(requestedEvents).toEqual([BOOKING_STATUS.CONFIRMED])
    expect(confirmedEvents).toHaveLength(1)

    const requestedOnlyEvents: string[] = []
    const confirmedOnlyEvents: string[] = []
    const {
      dependencies: requestedDependencies,
      resources: requestedResources,
      services,
    } = buildDependencies({
      hooks: {
        onBookingRequested: (event) => {
          requestedOnlyEvents.push(event.status)
        },
        onBookingConfirmed: (event) => {
          confirmedOnlyEvents.push(event.bookingId)
        },
      },
    })
    const requestedResource = await createResource(requestedResources)
    const service = await createService(services, { requiresConfirmation: true })

    await new RequestBookingUseCase(requestedDependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [requestedResource.id],
      },
    })

    expect(requestedOnlyEvents).toEqual([BOOKING_STATUS.REQUESTED])
    expect(confirmedOnlyEvents).toHaveLength(0)
  })
})

describe('ConfirmBookingUseCase', () => {
  it('transiciona requested para confirmed e anexa vídeo', async () => {
    const videoMeeting: VideoMeetingPort = {
      createMeeting: async () => ({ outcome: 'created', meetingUrl: 'https://video.example/room-2' }),
    }
    const confirmedEvents: string[] = []
    const { dependencies, resources, services } = buildDependencies({
      videoMeeting,
      hooks: {
        onBookingConfirmed: (event) => {
          confirmedEvents.push(event.bookingId)
        },
      },
    })
    const resource = await createResource(resources)
    const service = await createService(services, { requiresConfirmation: true })

    const { booking: requested } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [resource.id],
      },
    })

    const { booking: confirmed } = await new ConfirmBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: requested.id,
    })

    expect(confirmed.status).toBe(BOOKING_STATUS.CONFIRMED)
    expect(confirmed.meetingUrl).toBe('https://video.example/room-2')
    expect(confirmedEvents).toEqual([requested.id])
  })

  it('é idempotente fora do estado requested — não dispara evento de novo', async () => {
    const confirmedEvents: string[] = []
    const { dependencies, resources } = buildDependencies({
      hooks: {
        onBookingConfirmed: (event) => {
          confirmedEvents.push(event.bookingId)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED)
    confirmedEvents.length = 0

    const { booking: replayed } = await new ConfirmBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
    })

    expect(replayed.status).toBe(BOOKING_STATUS.CONFIRMED)
    expect(confirmedEvents).toHaveLength(0)
  })

  it('recusa reserva inexistente', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new ConfirmBookingUseCase(dependencies).execute({ companyId: COMPANY_ID, id: 'missing' }),
    ).rejects.toBeInstanceOf(BookingNotFoundError)
  })

  it('anexa evento de calendário ao confirmar', async () => {
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => ({ outcome: 'synced', externalEventId: 'ext-event-2' }),
      deleteEvent: async () => {},
      readEvents: async () => [],
    }
    const { dependencies, resources, services } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)
    const service = await createService(services, { requiresConfirmation: true })

    const { booking: requested } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [resource.id],
      },
    })

    const { booking: confirmed } = await new ConfirmBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: requested.id,
    })

    expect(confirmed.externalCalendarId).toBe('ext-event-2')
  })
})

describe('RescheduleBookingUseCase', () => {
  it('atualiza o horário e carrega previousDuring/during no evento', async () => {
    const rescheduledEvents: Array<{ previousDuring: { start: Date }; during: { start: Date } }> = []
    const { dependencies, resources } = buildDependencies({
      hooks: {
        onBookingRescheduled: (event) => {
          rescheduledEvents.push(event)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const newStart = new Date('2026-08-21T14:00:00.000Z')
    const newEnd = new Date('2026-08-21T14:30:00.000Z')
    const { booking: rescheduled, slots } = await new RescheduleBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { during: { start: newStart, end: newEnd } },
    })

    expect(rescheduled.startsAt).toEqual(newStart)
    expect(rescheduled.endsAt).toEqual(newEnd)
    expect(slots).toHaveLength(1)
    expect(rescheduledEvents).toHaveLength(1)
    expect(rescheduledEvents[0]?.previousDuring.start).toEqual(FUTURE_START)
    expect(rescheduledEvents[0]?.during.start).toEqual(newStart)
  })

  it('recusa remarcar para o passado', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const pastStart = new Date(NOW.getTime() - 60 * 60_000)
    const pastEnd = new Date(NOW.getTime() - 30 * 60_000)

    await expect(
      new RescheduleBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: booking.id,
        input: { during: { start: pastStart, end: pastEnd } },
      }),
    ).rejects.toBeInstanceOf(BookingInPastError)
  })

  it('reenvia o novo horário ao calendário externo quando já havia espelho', async () => {
    const upsertCalls: Array<{ externalCalendarId?: string; startsAt: Date }> = []
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async (payload) => {
        upsertCalls.push({ externalCalendarId: payload.externalCalendarId, startsAt: payload.startsAt })
        return { outcome: 'synced', externalEventId: 'ext-event-3' }
      },
      deleteEvent: async () => {},
      readEvents: async () => [],
    }
    const { dependencies, resources } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    expect(upsertCalls).toHaveLength(1)

    const newStart = new Date('2026-08-21T14:00:00.000Z')
    const newEnd = new Date('2026-08-21T14:30:00.000Z')
    const { booking: rescheduled } = await new RescheduleBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { during: { start: newStart, end: newEnd } },
    })

    expect(rescheduled.externalCalendarId).toBe('ext-event-3')
    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls[1]?.externalCalendarId).toBe('ext-event-3')
    expect(upsertCalls[1]?.startsAt).toEqual(newStart)
  })

  it('não cria espelho novo ao remarcar reserva sem sincronização prévia', async () => {
    const upsertCalls: number[] = []
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => {
        upsertCalls.push(1)
        return { outcome: 'synced', externalEventId: 'ext-event-4' }
      },
      deleteEvent: async () => {},
      readEvents: async () => [],
    }
    const { dependencies, resources, services } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)
    const service = await createService(services, { requiresConfirmation: true })

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: FUTURE_START, end: FUTURE_END },
        resourceIds: [resource.id],
      },
    })
    expect(booking.status).toBe(BOOKING_STATUS.REQUESTED)
    expect(upsertCalls).toHaveLength(0)

    const newStart = new Date('2026-08-21T14:00:00.000Z')
    const newEnd = new Date('2026-08-21T14:30:00.000Z')
    const { booking: rescheduled } = await new RescheduleBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { during: { start: newStart, end: newEnd } },
    })

    expect(rescheduled.externalCalendarId ?? null).toBeNull()
    expect(upsertCalls).toHaveLength(0)
  })

  it('F-019: recusa remarcar reserva já cancelada', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    const newStart = new Date('2026-08-21T14:00:00.000Z')
    const newEnd = new Date('2026-08-21T14:30:00.000Z')

    await expect(
      new RescheduleBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: booking.id,
        input: { during: { start: newStart, end: newEnd } },
      }),
    ).rejects.toBeInstanceOf(BookingNotModifiableError)
  })
})

describe('CancelBookingUseCase', () => {
  it('recusa cancelamento dentro da janela mínima de aviso do serviço', async () => {
    const { dependencies, resources, services } = buildDependencies()
    const resource = await createResource(resources)
    const service = await createService(services, { minCancellationNoticeMinutes: 120 })

    const soonStart = new Date(NOW.getTime() + 30 * 60_000)
    const soonEnd = new Date(NOW.getTime() + 60 * 60_000)
    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: soonStart, end: soonEnd },
        resourceIds: [resource.id],
      },
    })

    await expect(
      new CancelBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: booking.id,
        input: { cancelledBy: 'user-1' },
      }),
    ).rejects.toBeInstanceOf(CancellationTooLateError)
  })

  it('minCancellationNoticeMinutes = 0 desliga a checagem', async () => {
    const { dependencies, resources, services } = buildDependencies()
    const resource = await createResource(resources)
    const service = await createService(services, { minCancellationNoticeMinutes: 0 })

    const soonStart = new Date(NOW.getTime() + 5 * 60_000)
    const soonEnd = new Date(NOW.getTime() + 35 * 60_000)
    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Corte',
        serviceId: service.id,
        during: { start: soonStart, end: soonEnd },
        resourceIds: [resource.id],
      },
    })

    const { booking: cancelled } = await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED)
  })

  it('cancela, libera os slots e dispara onBookingCancelled', async () => {
    const cancelledEvents: Array<{ resourceIds: readonly string[]; cancelledBy: string }> = []
    const { dependencies, resources, bookings } = buildDependencies({
      hooks: {
        onBookingCancelled: (event) => {
          cancelledEvents.push(event)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const { booking: cancelled } = await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1', cancellationReason: 'imprevisto' },
    })

    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED)
    expect(bookings.slotsByBooking.get(booking.id) ?? []).toHaveLength(0)
    expect(cancelledEvents).toHaveLength(1)
    expect(cancelledEvents[0]?.resourceIds).toEqual([resource.id])
    expect(cancelledEvents[0]?.cancelledBy).toBe('user-1')
  })

  it('é idempotente sobre reserva já cancelada — sem novo evento', async () => {
    const cancelledEvents: string[] = []
    const { dependencies, resources } = buildDependencies({
      hooks: {
        onBookingCancelled: (event) => {
          cancelledEvents.push(event.bookingId)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })
    expect(cancelledEvents).toHaveLength(1)

    const { booking: replayed, slots } = await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-2' },
    })

    expect(replayed.status).toBe(BOOKING_STATUS.CANCELLED)
    expect(replayed.cancelledBy).toBe('user-1')
    expect(slots).toEqual([])
    expect(cancelledEvents).toHaveLength(1)
  })

  it('remove o espelho externo ao cancelar', async () => {
    const deletedIds: string[] = []
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => ({ outcome: 'synced', externalEventId: 'ext-event-5' }),
      deleteEvent: async (externalEventId) => {
        deletedIds.push(externalEventId)
      },
      readEvents: async () => [],
    }
    const { dependencies, resources } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    expect(deletedIds).toEqual(['ext-event-5'])
  })

  it('falha ao remover o espelho externo não bloqueia o cancelamento', async () => {
    const calendarSync: CalendarSyncPort = {
      upsertEvent: async () => ({ outcome: 'synced', externalEventId: 'ext-event-6' }),
      deleteEvent: async () => {
        throw new Error('provedor fora do ar')
      },
      readEvents: async () => [],
    }
    const { dependencies, resources } = buildDependencies({ calendarSync })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const { booking: cancelled } = await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED)
  })

  it('HIGH-1: recusa cancelar reserva já completed', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    await new CompleteBookingUseCase(dependencies).execute({ companyId: COMPANY_ID, id: booking.id })

    await expect(
      new CancelBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: booking.id,
        input: { cancelledBy: 'user-1' },
      }),
    ).rejects.toBeInstanceOf(BookingNotModifiableError)
  })

  it('HIGH-1: recusa cancelar reserva já no_show', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    await new MarkNoShowUseCase(dependencies).execute({ companyId: COMPANY_ID, id: booking.id })

    await expect(
      new CancelBookingUseCase(dependencies).execute({
        companyId: COMPANY_ID,
        id: booking.id,
        input: { cancelledBy: 'user-1' },
      }),
    ).rejects.toBeInstanceOf(BookingNotModifiableError)
  })
})

describe('CompleteBookingUseCase / MarkNoShowUseCase', () => {
  it('marca completed e dispara onBookingCompleted', async () => {
    const completedEvents: string[] = []
    const { dependencies, resources } = buildDependencies({
      hooks: {
        onBookingCompleted: (event) => {
          completedEvents.push(event.bookingId)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const { booking: completed } = await new CompleteBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
    })

    expect(completed.status).toBe(BOOKING_STATUS.COMPLETED)
    expect(completedEvents).toEqual([booking.id])
  })

  it('marca no_show e dispara onBookingNoShow', async () => {
    const noShowEvents: string[] = []
    const { dependencies, resources } = buildDependencies({
      hooks: {
        onBookingNoShow: (event) => {
          noShowEvents.push(event.bookingId)
        },
      },
    })
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const { booking: noShow } = await new MarkNoShowUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
    })

    expect(noShow.status).toBe(BOOKING_STATUS.NO_SHOW)
    expect(noShowEvents).toEqual([booking.id])
  })

  it('F-020: recusa completar reserva já cancelada', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    await expect(
      new CompleteBookingUseCase(dependencies).execute({ companyId: COMPANY_ID, id: booking.id }),
    ).rejects.toBeInstanceOf(BookingNotModifiableError)
  })

  it('F-020: recusa marcar no_show em reserva já cancelada', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })
    await new CancelBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: booking.id,
      input: { cancelledBy: 'user-1' },
    })

    await expect(
      new MarkNoShowUseCase(dependencies).execute({ companyId: COMPANY_ID, id: booking.id }),
    ).rejects.toBeInstanceOf(BookingNotModifiableError)
  })
})

describe('GetBookingUseCase / ListBookingsUseCase', () => {
  it('GetBookingUseCase devolve a reserva com seus slots', async () => {
    const { dependencies, resources } = buildDependencies()
    const resource = await createResource(resources)

    const { booking: created } = await new RequestBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resource.id] },
    })

    const { booking, slots } = await new GetBookingUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      id: created.id,
    })

    expect(booking.id).toBe(created.id)
    expect(slots).toHaveLength(1)
  })

  it('GetBookingUseCase recusa reserva inexistente', async () => {
    const { dependencies } = buildDependencies()

    await expect(
      new GetBookingUseCase(dependencies).execute({ companyId: COMPANY_ID, id: 'missing' }),
    ).rejects.toBeInstanceOf(BookingNotFoundError)
  })

  it('ListBookingsUseCase pagina e filtra por recurso', async () => {
    const { dependencies, resources } = buildDependencies()
    const resourceA = await createResource(resources, { name: 'Sala A' })
    const resourceB = await createResource(resources, { name: 'Sala B' })
    const useCase = new RequestBookingUseCase(dependencies)

    await useCase.execute({
      companyId: COMPANY_ID,
      input: { title: 'Reunião A', during: { start: FUTURE_START, end: FUTURE_END }, resourceIds: [resourceA.id] },
    })
    await useCase.execute({
      companyId: COMPANY_ID,
      input: {
        title: 'Reunião B',
        during: { start: new Date('2026-08-21T14:00:00.000Z'), end: new Date('2026-08-21T14:30:00.000Z') },
        resourceIds: [resourceB.id],
      },
    })

    const page = await new ListBookingsUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      resourceId: resourceA.id,
    })

    expect(page.total).toBe(1)
    expect(page.data[0]?.title).toBe('Reunião A')
  })
})
