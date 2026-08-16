/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type WidgetStep = 'service' | 'resource' | 'slot' | 'details' | 'confirmed'

export type WidgetService = {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly durationMinutes: number
  readonly priceInCents: number | null
}

/** `timezone` IANA do recurso — é o que permite mostrar o horário dele ao lado do horário do visitante. */
export type WidgetResource = {
  readonly id: string
  readonly name: string
  readonly timezone: string
}

export type WidgetSlot = {
  readonly resourceId: string
  readonly startsAt: string
  readonly endsAt: string
}

export type WidgetBookingResult = {
  readonly bookingId: string
  readonly status: string
}

export type WidgetApiParams = {
  readonly baseUrl: string
}

export type ListResourcesParams = {
  readonly serviceId: string
}

export type ListAvailabilityParams = {
  readonly serviceId: string
  readonly resourceId: string
  readonly from: string
  readonly to: string
}

export type RequestBookingParams = {
  readonly serviceId: string
  readonly resourceId: string
  readonly slot: WidgetSlot
  readonly customerName: string
  readonly customerContact: string
}

export type ThemeTokens = Readonly<Record<string, string>>

export type WidgetState = {
  readonly step: WidgetStep
  readonly isBusy: boolean
  readonly isOpen: boolean
  readonly errorMessage: string
  readonly services: readonly WidgetService[]
  readonly resources: readonly WidgetResource[]
  readonly slots: readonly WidgetSlot[]
  readonly selectedService: WidgetService | undefined
  readonly selectedResource: WidgetResource | undefined
  readonly selectedSlot: WidgetSlot | undefined
  readonly confirmedBookingId: string
}
