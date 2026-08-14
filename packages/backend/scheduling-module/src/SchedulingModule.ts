/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. Molde de `catalog-module/src/CatalogModule.ts`. `calendarSync.enabled` sem
 * `providers.calendarSync` plugado falha aqui, no boot — nunca na primeira tentativa de
 * sincronizar (T4.10).
 */

import { CalendarSyncDisabledError, ConfigMissingError } from '@adatechnology/scheduling-contracts'
import type {
  CalendarSyncPort,
  ClockPort,
  LoggerPort,
  SchedulingHooks,
  SchedulingModuleConfig,
  VideoMeetingPort,
} from '@adatechnology/scheduling-contracts'

import type { SchedulingDatabase } from './database.types'
import { AvailabilityRepository } from './repositories/AvailabilityRepository'
import { BookingRepository } from './repositories/BookingRepository'
import { ResourceRepository } from './repositories/ResourceRepository'
import { ServiceRepository } from './repositories/ServiceRepository'
import { ListAvailableSlotsUseCase } from './use-cases/Availability.use-cases'
import {
  CancelBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  GetBookingUseCase,
  ListBookingsUseCase,
  MarkNoShowUseCase,
  RequestBookingUseCase,
  RescheduleBookingUseCase,
} from './use-cases/Booking.use-cases'
import type { SchedulingDependencies } from './use-cases/schedulingModule.types'

export type SchedulingModuleProviders = {
  readonly videoMeeting?: VideoMeetingPort
  readonly calendarSync?: CalendarSyncPort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}

export type CreateSchedulingModuleParams = {
  readonly db: SchedulingDatabase
  readonly config: SchedulingModuleConfig
  readonly providers?: SchedulingModuleProviders
  readonly hooks?: SchedulingHooks
}

export type SchedulingModule = {
  readonly useCases: {
    readonly listAvailableSlots: ListAvailableSlotsUseCase
    readonly requestBooking: RequestBookingUseCase
    readonly confirmBooking: ConfirmBookingUseCase
    readonly rescheduleBooking: RescheduleBookingUseCase
    readonly cancelBooking: CancelBookingUseCase
    readonly completeBooking: CompleteBookingUseCase
    readonly markNoShow: MarkNoShowUseCase
    readonly getBooking: GetBookingUseCase
    readonly listBookings: ListBookingsUseCase
  }
  /** Capacidade opcional por ausência (`pluggable-module.md` §4) — o host consulta em vez de inferir da config. */
  readonly hasVideoMeeting: boolean
  readonly hasCalendarSync: boolean
}

export function createSchedulingModule(params: CreateSchedulingModuleParams): SchedulingModule {
  if (!params.config.maxLookaheadDays) throw new ConfigMissingError('maxLookaheadDays')

  if (params.config.calendarSync?.enabled && !params.providers?.calendarSync) {
    throw new CalendarSyncDisabledError()
  }

  const dependencies: SchedulingDependencies = {
    repositories: {
      resources: new ResourceRepository(params.db),
      services: new ServiceRepository(params.db),
      availability: new AvailabilityRepository(params.db),
      bookings: new BookingRepository(params.db),
    },
    config: params.config,
    hooks: params.hooks,
    clock: params.providers?.clock,
    logger: params.providers?.logger,
    videoMeeting: params.providers?.videoMeeting,
    calendarSync: params.providers?.calendarSync,
  }

  return {
    useCases: {
      listAvailableSlots: new ListAvailableSlotsUseCase(dependencies),
      requestBooking: new RequestBookingUseCase(dependencies),
      confirmBooking: new ConfirmBookingUseCase(dependencies),
      rescheduleBooking: new RescheduleBookingUseCase(dependencies),
      cancelBooking: new CancelBookingUseCase(dependencies),
      completeBooking: new CompleteBookingUseCase(dependencies),
      markNoShow: new MarkNoShowUseCase(dependencies),
      getBooking: new GetBookingUseCase(dependencies),
      listBookings: new ListBookingsUseCase(dependencies),
    },
    hasVideoMeeting: Boolean(params.providers?.videoMeeting),
    hasCalendarSync: Boolean(params.providers?.calendarSync),
  }
}
