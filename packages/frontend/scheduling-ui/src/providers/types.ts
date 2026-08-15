/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `SchedulingApi` é a fronteira com o host: cada método espelha um caso de uso de
 * `scheduling-module`, sem `companyId` — o host já resolve o tenant do contexto autenticado antes
 * de chamar o pacote (`security.md` §2, BOLA). O pacote nunca decide como a requisição é feita.
 */

import type {
  AvailabilityException,
  AvailabilityExceptionId,
  AvailabilityRule,
  AvailableSlot,
  Booking,
  BookingId,
  CancelBookingInput,
  CreateAvailabilityExceptionInput,
  CreateAvailabilityRuleInput,
  CreateResourceInput,
  CreateServiceInput,
  GetAvailabilityParams,
  ListBookingsParams,
  ListResourcesParams,
  ListServicesParams,
  PaginatedResponse,
  RequestBookingInput,
  RescheduleBookingInput,
  Resource,
  ResourceId,
  Service,
  ServiceId,
  UpdateResourceInput,
  UpdateServiceInput,
} from '@adatechnology/scheduling-contracts'

export type SchedulingApi = {
  listResources(params?: Omit<ListResourcesParams, 'companyId'>): Promise<PaginatedResponse<Resource>>
  createResource(input: CreateResourceInput): Promise<Resource>
  updateResource(id: ResourceId, input: UpdateResourceInput): Promise<Resource>
  deleteResource(id: ResourceId): Promise<void>

  listServices(params?: Omit<ListServicesParams, 'companyId'>): Promise<PaginatedResponse<Service>>
  createService(input: CreateServiceInput): Promise<Service>
  updateService(id: ServiceId, input: UpdateServiceInput): Promise<Service>
  deleteService(id: ServiceId): Promise<void>

  listAvailabilityRules(resourceId: ResourceId): Promise<readonly AvailabilityRule[]>
  setAvailabilityRules(
    resourceId: ResourceId,
    rules: readonly CreateAvailabilityRuleInput[],
  ): Promise<readonly AvailabilityRule[]>
  listAvailabilityExceptions(resourceId: ResourceId): Promise<readonly AvailabilityException[]>
  addAvailabilityException(input: CreateAvailabilityExceptionInput): Promise<AvailabilityException>
  removeAvailabilityException(id: AvailabilityExceptionId): Promise<void>

  getAvailableSlots(params: Omit<GetAvailabilityParams, 'companyId'>): Promise<readonly AvailableSlot[]>

  listBookings(params?: Omit<ListBookingsParams, 'companyId'>): Promise<PaginatedResponse<Booking>>
  getBooking(id: BookingId): Promise<Booking>
  requestBooking(input: RequestBookingInput, idempotencyKey: string): Promise<Booking>
  confirmBooking(id: BookingId): Promise<Booking>
  rescheduleBooking(id: BookingId, input: RescheduleBookingInput): Promise<Booking>
  cancelBooking(id: BookingId, input: CancelBookingInput): Promise<Booking>
  completeBooking(id: BookingId): Promise<Booking>
  markNoShow(id: BookingId): Promise<Booking>
}

export type SchedulingUiConfig = {
  readonly locale: string
  /** 0 = domingo, 1 = segunda — só a grade de agenda (T7.3) e o editor de disponibilidade (T7.4) usam. */
  readonly weekStartsOn: 0 | 1
}

export const DEFAULT_SCHEDULING_UI_CONFIG: SchedulingUiConfig = {
  locale: 'pt-BR',
  weekStartsOn: 1,
}
