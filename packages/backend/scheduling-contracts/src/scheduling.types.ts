/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fonte única dos tipos de agendamento. Um recurso com disponibilidade, uma faixa de tempo,
 * participantes, e a garantia de não sobrepor — "agendar serviço" e "marcar reunião" são o mesmo
 * núcleo (spec §2), então um único conjunto de tipos serve os dois cenários.
 */

export type ResourceId = string
export type ServiceId = string
export type AvailabilityRuleId = string
export type AvailabilityExceptionId = string
export type BookingId = string
export type BookingSlotId = string
export type BookingParticipantId = string
export type CompanyId = string

/** Instante UTC — o que a reserva guarda. Faixa de hora de parede vive em `startsAtLocal`/`endsAtLocal`. */
export type TimeRange = {
  readonly start: Date
  readonly end: Date
}

export const RESOURCE_KIND = {
  PERSON: 'person',
  ROOM: 'room',
  EQUIPMENT: 'equipment',
} as const
export type ResourceKind = (typeof RESOURCE_KIND)[keyof typeof RESOURCE_KIND]

export const AVAILABILITY_EXCEPTION_KIND = {
  /** Bloqueia um horário que a regra semanal deixaria livre — folga, feriado, manutenção. */
  BLOCK: 'block',
  /** Libera um horário fora da regra semanal — encaixe pontual fora do expediente. */
  EXTRA: 'extra',
} as const
export type AvailabilityExceptionKind = (typeof AVAILABILITY_EXCEPTION_KIND)[keyof typeof AVAILABILITY_EXCEPTION_KIND]

export const BOOKING_STATUS = {
  /** Ocupa a agenda desde já — recusar depois libera o slot (spec §9.2). */
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
} as const
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

export const BOOKING_PARTICIPANT_ROLE = {
  ORGANIZER: 'organizer',
  ATTENDEE: 'attendee',
} as const
export type BookingParticipantRole = (typeof BOOKING_PARTICIPANT_ROLE)[keyof typeof BOOKING_PARTICIPANT_ROLE]

export const BOOKING_PARTICIPANT_RESPONSE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
} as const
export type BookingParticipantResponseStatus =
  (typeof BOOKING_PARTICIPANT_RESPONSE_STATUS)[keyof typeof BOOKING_PARTICIPANT_RESPONSE_STATUS]

/** Presencial ou sala/equipamento — nunca usuário do módulo (spec §4, "não conhece usuário"). */
export type Resource = {
  readonly id: ResourceId
  readonly companyId: CompanyId
  readonly name: string
  readonly kind: ResourceKind
  /** IANA, ex.: `America/Sao_Paulo`. Fica no recurso, não na empresa (spec §5.3). */
  readonly timezone: string
  /** Referência opaca do produto (profissional, equipe) — nunca dado pessoal (spec §6). */
  readonly externalRef?: string | null
  readonly active: boolean
  readonly deletedAt?: Date | null
}

export type Service = {
  readonly id: ServiceId
  readonly companyId: CompanyId
  readonly name: string
  readonly description?: string | null
  readonly durationMinutes: number
  readonly bufferBeforeMinutes: number
  readonly bufferAfterMinutes: number
  /** Centavos inteiros — mesma regra de `catalog-contracts`. `null` = serviço sem preço fixo. */
  readonly priceInCents?: number | null
  readonly requiresConfirmation: boolean
  /** `0` desliga a janela mínima de cancelamento (spec, T4.6). */
  readonly minCancellationNoticeMinutes: number
  readonly active: boolean
  readonly sortOrder: number
  readonly deletedAt?: Date | null
}

/** Junção: quais recursos atendem qual serviço — filtra a fatia de disponibilidade (spec §7). */
export type ResourceService = {
  readonly companyId: CompanyId
  readonly resourceId: ResourceId
  readonly serviceId: ServiceId
}

export type AvailabilityRule = {
  readonly id: AvailabilityRuleId
  readonly companyId: CompanyId
  readonly resourceId: ResourceId
  /** 0 = domingo … 6 = sábado. */
  readonly weekday: number
  /** Hora de parede, formato `HH:mm` — nunca convertida para UTC no cadastro (spec §5.3). */
  readonly startsAtLocal: string
  readonly endsAtLocal: string
  readonly validFrom?: Date | null
  readonly validUntil?: Date | null
}

export type AvailabilityException = {
  readonly id: AvailabilityExceptionId
  readonly companyId: CompanyId
  readonly resourceId: ResourceId
  readonly during: TimeRange
  readonly kind: AvailabilityExceptionKind
  readonly reason?: string | null
}

export type Booking = {
  readonly id: BookingId
  readonly companyId: CompanyId
  /** Ausente = reunião ad-hoc sem serviço catalogado (spec §2). */
  readonly serviceId?: ServiceId | null
  readonly title: string
  readonly status: BookingStatus
  /**
   * Resumo de leitura para ordenar/filtrar a listagem sem juntar `booking_slots` — não é a faixa
   * protegida contra sobreposição, que vive por recurso (spec §5.1).
   */
  readonly startsAt: Date
  readonly endsAt: Date
  /** Referências opacas — nome, telefone e e-mail ficam no produto (spec §6). */
  readonly customerRef?: string | null
  readonly organizerRef?: string | null
  readonly meetingUrl?: string | null
  readonly externalCalendarId?: string | null
  readonly notes?: string | null
  readonly cancelledAt?: Date | null
  readonly cancelledBy?: string | null
  readonly cancellationReason?: string | null
  readonly reminderSentAt?: Date | null
  readonly idempotencyKey?: string | null
}

/** Uma linha por recurso consumido — o que faz os dois cenários caberem na mesma constraint (spec §5.1). */
export type BookingSlot = {
  readonly id: BookingSlotId
  readonly bookingId: BookingId
  readonly resourceId: ResourceId
  /** Contrato com o cliente — o que a ponta pública mostra. */
  readonly during: TimeRange
  /** `during` mais os buffers do serviço — o que a constraint `EXCLUDE` protege (spec §5.2). */
  readonly blocking: TimeRange
}

export type BookingParticipant = {
  readonly id: BookingParticipantId
  readonly bookingId: BookingId
  readonly participantRef: string
  /** Ausente = participante sem agenda própria no módulo (ex.: cliente externo). */
  readonly resourceId?: ResourceId | null
  readonly role: BookingParticipantRole
  readonly responseStatus?: BookingParticipantResponseStatus | null
}

/** Resultado do cálculo em leitura (spec §7) — nunca uma linha persistida. */
export type AvailableSlot = {
  readonly resourceId: ResourceId
  readonly serviceId?: ServiceId | null
  readonly startsAt: Date
  readonly endsAt: Date
}

export type PaginatedResponse<TItem> = {
  readonly data: readonly TItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

export type CreateResourceInput = {
  readonly name: string
  readonly kind: ResourceKind
  readonly timezone: string
  readonly externalRef?: string
}

export type UpdateResourceInput = Partial<CreateResourceInput> & {
  readonly active?: boolean
}

export type CreateServiceInput = {
  readonly name: string
  readonly description?: string
  readonly durationMinutes: number
  readonly bufferBeforeMinutes?: number
  readonly bufferAfterMinutes?: number
  readonly priceInCents?: number
  readonly requiresConfirmation?: boolean
  readonly minCancellationNoticeMinutes?: number
  readonly sortOrder?: number
}

export type UpdateServiceInput = Partial<CreateServiceInput> & {
  readonly active?: boolean
}

export type CreateAvailabilityRuleInput = {
  readonly resourceId: ResourceId
  readonly weekday: number
  readonly startsAtLocal: string
  readonly endsAtLocal: string
  readonly validFrom?: Date
  readonly validUntil?: Date
}

export type CreateAvailabilityExceptionInput = {
  readonly resourceId: ResourceId
  readonly during: TimeRange
  readonly kind: AvailabilityExceptionKind
  readonly reason?: string
}

/**
 * Uma linha por recurso — `resourceId` único vira 1 slot (serviço), lista com N vira reunião
 * (spec §5.1). `idempotencyKey` viaja no header `Idempotency-Key`, nunca no corpo (`apis.md`).
 */
export type RequestBookingInput = {
  readonly title: string
  readonly serviceId?: ServiceId
  readonly during: TimeRange
  readonly resourceIds: readonly ResourceId[]
  readonly customerRef?: string
  readonly organizerRef?: string
  readonly notes?: string
  readonly participants?: ReadonlyArray<{
    readonly participantRef: string
    readonly resourceId?: ResourceId
    readonly role: BookingParticipantRole
  }>
}

export type RescheduleBookingInput = {
  readonly during: TimeRange
}

export type CancelBookingInput = {
  readonly cancelledBy: string
  readonly cancellationReason?: string
}

export type ListResourcesParams = {
  readonly companyId: CompanyId
  readonly page?: number
  readonly pageSize?: number
  readonly kind?: ResourceKind
  readonly active?: boolean
}

export type ListServicesParams = {
  readonly companyId: CompanyId
  readonly page?: number
  readonly pageSize?: number
  readonly active?: boolean
}

export type ListBookingsParams = {
  readonly companyId: CompanyId
  readonly page?: number
  readonly pageSize?: number
  readonly resourceId?: ResourceId
  readonly status?: BookingStatus
  readonly from?: Date
  readonly until?: Date
}

export type GetAvailabilityParams = {
  readonly companyId: CompanyId
  readonly resourceId: ResourceId
  readonly serviceId: ServiceId
  readonly from: Date
  readonly until: Date
}
