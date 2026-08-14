/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CompanyId } from './scheduling.types'

export type AuthContext = {
  readonly companyId: CompanyId
  readonly userId?: string
  readonly scopes: readonly string[]
}

/**
 * Identidade **já validada pelo host** — o módulo não verifica token nem conhece o emissor da
 * sessão (`security.md` §2).
 */
export interface AuthContextResolverPort {
  resolve(params: { readonly headers: Readonly<Record<string, string>> }): Promise<AuthContext | undefined>
}

export type VideoMeetingRequest = {
  readonly bookingId: string
  readonly title: string
  readonly startsAt: Date
  readonly endsAt: Date
}

export type VideoMeetingOutcome =
  | { readonly outcome: 'created'; readonly meetingUrl: string }
  | { readonly outcome: 'failed'; readonly errorCode: string; readonly message: string }

/**
 * Ausente = agendamento presencial, sem link, sem affordance na UI (spec §8). Chamada na
 * confirmação; falha **não bloqueia** a reserva (spec §9.6, T4.9).
 */
export interface VideoMeetingPort {
  createMeeting(request: VideoMeetingRequest): Promise<VideoMeetingOutcome>
  deleteMeeting?(meetingUrl: string): Promise<void>
}

export type CalendarEventPayload = {
  readonly externalCalendarId?: string
  readonly title: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly notes?: string
}

export type CalendarSyncOutcome =
  | { readonly outcome: 'synced'; readonly externalEventId: string }
  | { readonly outcome: 'failed'; readonly errorCode: string; readonly message: string }

/**
 * Espelho **one-way (push)** na v1 — sem webhook do fornecedor, sem sync token, sem resolução de
 * conflito bidirecional (spec §8). Ausente = sem espelho no Google/Outlook.
 *
 * `readEvents` já nasce declarado, mesmo sem implementação: adicionar depois seria breaking
 * change no contrato publicado.
 */
export interface CalendarSyncPort {
  upsertEvent(payload: CalendarEventPayload): Promise<CalendarSyncOutcome>
  deleteEvent(externalEventId: string): Promise<void>
  readEvents(params: {
    readonly from: Date
    readonly until: Date
  }): Promise<readonly { readonly externalEventId: string; readonly startsAt: Date; readonly endsAt: Date }[]>
}

export interface ClockPort {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export type SchedulingModuleConfig = {
  /** Teto de dias consultáveis numa janela de disponibilidade — evita varredura acidental (T3.5). */
  readonly maxLookaheadDays: number
  /** `0` desliga a janela mínima de cancelamento por completo (T4.6). */
  readonly defaultMinCancellationNoticeMinutes?: number
}
