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
import {
  AddAvailabilityExceptionUseCase,
  ListAvailabilityExceptionsUseCase,
  ListAvailabilityRulesUseCase,
  ListAvailableSlotsUseCase,
  RemoveAvailabilityExceptionUseCase,
  SetAvailabilityRulesUseCase,
} from './use-cases/Availability.use-cases'
import {
  CancelBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  GetBookingUseCase,
  ListBookingsUseCase,
  MarkNoShowUseCase,
  RequestBookingUseCase,
  RescheduleBookingUseCase,
  SyncBookingCalendarUseCase,
} from './use-cases/Booking.use-cases'
import {
  CreateResourceUseCase,
  DeleteResourceUseCase,
  GetResourceUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from './use-cases/Resource.use-cases'
import type { SchedulingDependencies } from './use-cases/schedulingModule.types'
import {
  CreateServiceUseCase,
  DeleteServiceUseCase,
  GetServiceUseCase,
  LinkResourceToServiceUseCase,
  ListServicesUseCase,
  UnlinkResourceFromServiceUseCase,
  UpdateServiceUseCase,
} from './use-cases/Service.use-cases'

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
    readonly createResource: CreateResourceUseCase
    readonly updateResource: UpdateResourceUseCase
    readonly deleteResource: DeleteResourceUseCase
    readonly getResource: GetResourceUseCase
    readonly listResources: ListResourcesUseCase
    readonly createService: CreateServiceUseCase
    readonly updateService: UpdateServiceUseCase
    readonly deleteService: DeleteServiceUseCase
    readonly getService: GetServiceUseCase
    readonly listServices: ListServicesUseCase
    readonly linkResourceToService: LinkResourceToServiceUseCase
    readonly unlinkResourceFromService: UnlinkResourceFromServiceUseCase
    readonly setAvailabilityRules: SetAvailabilityRulesUseCase
    readonly listAvailabilityRules: ListAvailabilityRulesUseCase
    readonly addAvailabilityException: AddAvailabilityExceptionUseCase
    readonly listAvailabilityExceptions: ListAvailabilityExceptionsUseCase
    readonly removeAvailabilityException: RemoveAvailabilityExceptionUseCase
    readonly listAvailableSlots: ListAvailableSlotsUseCase
    readonly requestBooking: RequestBookingUseCase
    readonly confirmBooking: ConfirmBookingUseCase
    readonly rescheduleBooking: RescheduleBookingUseCase
    readonly cancelBooking: CancelBookingUseCase
    readonly completeBooking: CompleteBookingUseCase
    readonly markNoShow: MarkNoShowUseCase
    readonly getBooking: GetBookingUseCase
    readonly listBookings: ListBookingsUseCase
    readonly syncBookingCalendar: SyncBookingCalendarUseCase
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
      createResource: new CreateResourceUseCase(dependencies),
      updateResource: new UpdateResourceUseCase(dependencies),
      deleteResource: new DeleteResourceUseCase(dependencies),
      getResource: new GetResourceUseCase(dependencies),
      listResources: new ListResourcesUseCase(dependencies),
      createService: new CreateServiceUseCase(dependencies),
      updateService: new UpdateServiceUseCase(dependencies),
      deleteService: new DeleteServiceUseCase(dependencies),
      getService: new GetServiceUseCase(dependencies),
      listServices: new ListServicesUseCase(dependencies),
      linkResourceToService: new LinkResourceToServiceUseCase(dependencies),
      unlinkResourceFromService: new UnlinkResourceFromServiceUseCase(dependencies),
      setAvailabilityRules: new SetAvailabilityRulesUseCase(dependencies),
      listAvailabilityRules: new ListAvailabilityRulesUseCase(dependencies),
      addAvailabilityException: new AddAvailabilityExceptionUseCase(dependencies),
      listAvailabilityExceptions: new ListAvailabilityExceptionsUseCase(dependencies),
      removeAvailabilityException: new RemoveAvailabilityExceptionUseCase(dependencies),
      listAvailableSlots: new ListAvailableSlotsUseCase(dependencies),
      requestBooking: new RequestBookingUseCase(dependencies),
      confirmBooking: new ConfirmBookingUseCase(dependencies),
      rescheduleBooking: new RescheduleBookingUseCase(dependencies),
      cancelBooking: new CancelBookingUseCase(dependencies),
      completeBooking: new CompleteBookingUseCase(dependencies),
      markNoShow: new MarkNoShowUseCase(dependencies),
      getBooking: new GetBookingUseCase(dependencies),
      listBookings: new ListBookingsUseCase(dependencies),
      syncBookingCalendar: new SyncBookingCalendarUseCase(dependencies),
    },
    hasVideoMeeting: Boolean(params.providers?.videoMeeting),
    hasCalendarSync: Boolean(params.providers?.calendarSync),
  }
}
