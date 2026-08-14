/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida: pacote publicado não importa o `DomainError` do host. Molde:
 * `catalog-contracts/src/errors.ts`.
 */

export class SchedulingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'SchedulingError'
  }
}

export const SCHEDULING_ERROR_CODES = {
  RESOURCE_NOT_FOUND: 'SCHEDULING_RESOURCE_NOT_FOUND',
  SERVICE_NOT_FOUND: 'SCHEDULING_SERVICE_NOT_FOUND',
  AVAILABILITY_EXCEPTION_NOT_FOUND: 'SCHEDULING_AVAILABILITY_EXCEPTION_NOT_FOUND',
  BOOKING_NOT_FOUND: 'SCHEDULING_BOOKING_NOT_FOUND',
  SLOT_UNAVAILABLE: 'SCHEDULING_SLOT_UNAVAILABLE',
  CANCELLATION_TOO_LATE: 'SCHEDULING_CANCELLATION_TOO_LATE',
  BOOKING_IN_PAST: 'SCHEDULING_BOOKING_IN_PAST',
  RESOURCE_UNAVAILABLE: 'SCHEDULING_RESOURCE_UNAVAILABLE',
  SERVICE_NOT_OFFERED_BY_RESOURCE: 'SCHEDULING_SERVICE_NOT_OFFERED_BY_RESOURCE',
  CONFIG_MISSING: 'SCHEDULING_CONFIG_MISSING',
  LOOKAHEAD_WINDOW_TOO_LARGE: 'SCHEDULING_LOOKAHEAD_WINDOW_TOO_LARGE',
  CALENDAR_SYNC_DISABLED: 'SCHEDULING_CALENDAR_SYNC_DISABLED',
} as const

export class ResourceNotFoundError extends SchedulingError {
  constructor(public readonly resourceId: string) {
    super('Recurso não encontrado.', 404, SCHEDULING_ERROR_CODES.RESOURCE_NOT_FOUND, { resourceId })
  }
}

export class ServiceNotFoundError extends SchedulingError {
  constructor(public readonly serviceId: string) {
    super('Serviço não encontrado.', 404, SCHEDULING_ERROR_CODES.SERVICE_NOT_FOUND, { serviceId })
  }
}

export class AvailabilityExceptionNotFoundError extends SchedulingError {
  constructor(public readonly availabilityExceptionId: string) {
    super('Exceção de disponibilidade não encontrada.', 404, SCHEDULING_ERROR_CODES.AVAILABILITY_EXCEPTION_NOT_FOUND, {
      availabilityExceptionId,
    })
  }
}

export class BookingNotFoundError extends SchedulingError {
  constructor(public readonly bookingId: string) {
    super('Reserva não encontrada.', 404, SCHEDULING_ERROR_CODES.BOOKING_NOT_FOUND, { bookingId })
  }
}

/**
 * Tradução da violação da constraint `booking_slot_no_overlap` (spec §5.2) — o cliente nunca vê
 * erro cru do Postgres.
 */
export class SlotUnavailableError extends SchedulingError {
  constructor(
    public readonly resourceId: string,
    public readonly during: { readonly start: Date; readonly end: Date },
  ) {
    super('Horário não está mais disponível para este recurso.', 409, SCHEDULING_ERROR_CODES.SLOT_UNAVAILABLE, {
      resourceId,
      during,
    })
  }
}

/** `minCancellationNoticeMinutes` do serviço violado — `0` desliga esta checagem por completo. */
export class CancellationTooLateError extends SchedulingError {
  constructor(
    public readonly bookingId: string,
    public readonly minCancellationNoticeMinutes: number,
  ) {
    super('Prazo mínimo para cancelamento já passou.', 409, SCHEDULING_ERROR_CODES.CANCELLATION_TOO_LATE, {
      bookingId,
      minCancellationNoticeMinutes,
    })
  }
}

export class BookingInPastError extends SchedulingError {
  constructor(public readonly startsAt: Date) {
    super(
      'Não é possível agendar ou remarcar para um horário no passado.',
      400,
      SCHEDULING_ERROR_CODES.BOOKING_IN_PAST,
      {
        startsAt,
      },
    )
  }
}

/** Recurso inativo, excluído, ou fora da janela de `availability_rules`/`validFrom`/`validUntil`. */
export class ResourceUnavailableError extends SchedulingError {
  constructor(public readonly resourceId: string) {
    super('Recurso indisponível.', 409, SCHEDULING_ERROR_CODES.RESOURCE_UNAVAILABLE, { resourceId })
  }
}

export class ServiceNotOfferedByResourceError extends SchedulingError {
  constructor(
    public readonly resourceId: string,
    public readonly serviceId: string,
  ) {
    super('Este recurso não atende este serviço.', 400, SCHEDULING_ERROR_CODES.SERVICE_NOT_OFFERED_BY_RESOURCE, {
      resourceId,
      serviceId,
    })
  }
}

/**
 * Único erro que nomeia o campo na mensagem: é lido por quem sobe o serviço, não devolvido a
 * cliente. Nome do campo, nunca o valor.
 */
export class ConfigMissingError extends SchedulingError {
  constructor(public readonly field: string) {
    super(`Configuração obrigatória ausente: ${field}.`, 500, SCHEDULING_ERROR_CODES.CONFIG_MISSING, { field })
  }
}

/** Janela `until - from` maior que `maxLookaheadDays` da config — consulta de anos é varredura acidental (T3.5). */
export class LookaheadWindowTooLargeError extends SchedulingError {
  constructor(
    public readonly requestedDays: number,
    public readonly maxLookaheadDays: number,
  ) {
    super(
      'Janela de disponibilidade consultada excede o máximo permitido.',
      400,
      SCHEDULING_ERROR_CODES.LOOKAHEAD_WINDOW_TOO_LARGE,
      { requestedDays, maxLookaheadDays },
    )
  }
}

/** `config.calendarSync.enabled` sem `providers.calendarSync` plugado (T4.10). */
export class CalendarSyncDisabledError extends SchedulingError {
  constructor() {
    super(
      'Sincronização com o calendário está desligada para este módulo.',
      409,
      SCHEDULING_ERROR_CODES.CALENDAR_SYNC_DISABLED,
    )
  }
}
