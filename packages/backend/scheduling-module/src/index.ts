/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type { SchedulingDatabase, DrizzleMigrateFunction } from './database.types'

export {
  schedulingSchema,
  resources,
  services,
  resourceServices,
  availabilityRules,
  availabilityExceptions,
  bookings,
  bookingSlots,
  bookingParticipants,
} from './schema/schema'
export type {
  ResourceRow,
  NewResourceRow,
  ServiceRow,
  NewServiceRow,
  ResourceServiceRow,
  NewResourceServiceRow,
  AvailabilityRuleRow,
  NewAvailabilityRuleRow,
  AvailabilityExceptionRow,
  NewAvailabilityExceptionRow,
  BookingRow,
  NewBookingRow,
  BookingSlotRow,
  NewBookingSlotRow,
  BookingParticipantRow,
  NewBookingParticipantRow,
} from './schema/schema'

export { SCHEDULING_MIGRATIONS_TABLE, schedulingMigrationsFolder, runSchedulingMigrations } from './runMigrations'
export type { RunSchedulingMigrationsParams } from './runMigrations'

export { ResourceRepository } from './repositories/ResourceRepository'
export type { ListResourcesQuery, ListResourcesPage } from './repositories/ResourceRepository'

export { ServiceRepository } from './repositories/ServiceRepository'
export type { ListServicesQuery, ListServicesPage } from './repositories/ServiceRepository'

export { AvailabilityRepository } from './repositories/AvailabilityRepository'

export { BookingRepository } from './repositories/BookingRepository'
export type { ListBookingsQuery, ListBookingsPage } from './repositories/BookingRepository'

export { createSchedulingSchedules } from './worker'
export type { SchedulingSchedule } from './worker'

export {
  resourceOwnedByCondition,
  resourceListCondition,
  serviceOwnedByCondition,
  serviceListCondition,
  availabilityRuleListCondition,
  availabilityExceptionListCondition,
  bookingOwnedByCondition,
  bookingListCondition,
} from './repositories/conditions'

export { nowOf, runHook } from './use-cases/schedulingModule.types'
export type { SchedulingRepositories, SchedulingDependencies } from './use-cases/schedulingModule.types'

export {
  AddAvailabilityExceptionUseCase,
  ListAvailabilityExceptionsUseCase,
  ListAvailabilityRulesUseCase,
  ListAvailableSlotsUseCase,
  RemoveAvailabilityExceptionUseCase,
  SetAvailabilityRulesUseCase,
} from './use-cases/Availability.use-cases'

export {
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

export { SweepDueRemindersUseCase } from './use-cases/Reminders.use-cases'

export {
  CreateResourceUseCase,
  DeleteResourceUseCase,
  GetResourceUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from './use-cases/Resource.use-cases'

export {
  CreateServiceUseCase,
  DeleteServiceUseCase,
  GetServiceUseCase,
  LinkResourceToServiceUseCase,
  ListServicesUseCase,
  UnlinkResourceFromServiceUseCase,
  UpdateServiceUseCase,
} from './use-cases/Service.use-cases'

export {
  toAvailabilityException,
  toAvailabilityRule,
  toBooking,
  toBookingSlot,
  toResource,
  toService,
} from './shared/toContract'

export { createSchedulingModule } from './SchedulingModule'
export type { SchedulingModule, SchedulingModuleProviders, CreateSchedulingModuleParams } from './SchedulingModule'
