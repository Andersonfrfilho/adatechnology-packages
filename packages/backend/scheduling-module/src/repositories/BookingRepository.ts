/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm'
import { SlotUnavailableError, type BookingSortColumn, type SortDirection } from '@adatechnology/scheduling-contracts'

import type { SchedulingDatabase } from '../database.types'
import {
  bookingParticipants,
  bookingSlots,
  bookings,
  type BookingRow,
  type BookingSlotRow,
  type NewBookingParticipantRow,
  type NewBookingRow,
  type NewBookingSlotRow,
} from '../schema/schema'
import { bookingListCondition, bookingOwnedByCondition } from './conditions'

export type ListBookingsQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly resourceId?: string
  readonly status?: readonly string[]
  readonly from?: Date
  readonly until?: Date
  readonly sortBy?: BookingSortColumn
  readonly sortDirection?: SortDirection
}

export type ListBookingsPage = {
  readonly rows: BookingRow[]
  readonly total: number
}

// H-2: coluna real por chave de ordenação — mapa explícito em vez de indexação dinâmica,
// para nunca expor uma coluna fora desta lista a uma string vinda da query.
const BOOKING_SORT_COLUMNS = {
  title: bookings.title,
  status: bookings.status,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
} as const

// Código Postgres para violação de `EXCLUDE` (vs. `23505`, violação de unique) — é o que a
// constraint `booking_slot_no_overlap` levanta (spec §5.2).
const POSTGRES_EXCLUSION_VIOLATION = '23P01'

// F-006: `idx_bookings_company_idempotency` é `unique`, não `exclude` — duas requisições
// concorrentes com a mesma `Idempotency-Key` podem passar as duas pelo `findByIdempotencyKey`
// (T4.3) antes de qualquer uma inserir; quem perde a corrida recebe `23505` do Postgres, não
// `23P01`.
const POSTGRES_UNIQUE_VIOLATION = '23505'

// F-018: com `EXCLUDE`, duas transações que inserem tuplas conflitantes quase ao mesmo tempo podem
// travar uma na tupla especulativa da outra em vez de uma delas bloquear na constraint — o Postgres
// resolve o impasse abortando uma das duas com `40P01` (deadlock), não `23P01`. Nas duas gravações
// que usam essa constraint (`createWithSlots`, `rescheduleWithSlotReplace`), o único recurso em
// disputa é o slot, então o deadlock carrega o mesmo significado de negócio da violação de exclusão.
const POSTGRES_DEADLOCK_DETECTED = '40P01'

// O código Postgres da constraint viola aparece em `code` na maioria dos drivers (`postgres`,
// `node-postgres`), mas o cliente SQL nativo do Bun usa `code` para o próprio erro genérico
// (`ERR_POSTGRES_SERVER_ERROR`) e guarda o código real do Postgres em `errno` — checar os dois
// mantém `BookingRepository` funcionando com qualquer driver, como o resto do módulo promete.
function hasPostgresCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; errno?: unknown }
  return candidate.code === code || candidate.errno === code
}

// `drizzle-orm` embrulha o erro do driver em `DrizzleQueryError`, preservando o original em
// `.cause` (ver `drizzle-orm/errors.ts`) — o código Postgres nunca está no erro capturado
// diretamente, só na causa.
function hasErrorCode(error: unknown, code: string): boolean {
  return (
    hasPostgresCode(error, code) ||
    (error instanceof Error && error.cause !== undefined && hasPostgresCode(error.cause, code))
  )
}

function isExclusionViolation(error: unknown): boolean {
  return hasErrorCode(error, POSTGRES_EXCLUSION_VIOLATION) || hasErrorCode(error, POSTGRES_DEADLOCK_DETECTED)
}

function isUniqueViolation(error: unknown): boolean {
  return hasErrorCode(error, POSTGRES_UNIQUE_VIOLATION)
}

export class BookingRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  /**
   * Grava a reserva e um `booking_slot` por recurso na mesma transação — 1 recurso é agendamento
   * de serviço, 2+ é reunião (spec §5.1). A constraint `EXCLUDE` decide o conflito no banco, não
   * em leitura-e-depois-grava no código: dois pedidos simultâneos do mesmo horário nunca passam
   * os dois, porque não há janela entre checar e gravar.
   *
   * F-006: o mesmo vale para `Idempotency-Key` — `RequestBookingUseCase` já checa
   * `findByIdempotencyKey` antes de chamar este método, mas duas requisições com a mesma chave
   * podem passar essa checagem as duas antes de qualquer uma inserir. Quem perde a corrida do
   * `unique` (`23505`) não recebe erro: busca a reserva vencedora e devolve `created: false`,
   * mesmo contrato de replay do caminho de pré-checagem.
   */
  async createWithSlots(params: {
    booking: NewBookingRow
    slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
    participants?: ReadonlyArray<Omit<NewBookingParticipantRow, 'bookingId'>>
  }): Promise<{ booking: BookingRow; slots: BookingSlotRow[]; created: boolean }> {
    try {
      const { booking, slots } = await this.db.transaction(async (tx) => {
        const [booking] = await tx.insert(bookings).values(params.booking).returning()
        if (!booking) throw new Error('scheduling-module: insert em bookings não retornou linha')

        const slots = await tx
          .insert(bookingSlots)
          .values(params.slots.map((slot) => ({ ...slot, bookingId: booking.id })))
          .returning()

        if (params.participants && params.participants.length > 0) {
          await tx
            .insert(bookingParticipants)
            .values(params.participants.map((participant) => ({ ...participant, bookingId: booking.id })))
        }

        return { booking, slots }
      })
      return { booking, slots, created: true }
    } catch (error) {
      if (isUniqueViolation(error) && params.booking.idempotencyKey) {
        const replay = await this.findByIdempotencyKey({
          companyId: params.booking.companyId,
          idempotencyKey: params.booking.idempotencyKey,
        })
        if (replay) {
          const slots = await this.findSlotsByBooking({ bookingId: replay.id })
          return { booking: replay, slots, created: false }
        }
      }
      if (isExclusionViolation(error)) {
        const conflicting = params.slots[0]
        throw new SlotUnavailableError(conflicting?.resourceId ?? '', {
          start: conflicting?.blockingStart ?? new Date(),
          end: conflicting?.blockingEnd ?? new Date(),
        })
      }
      throw error
    }
  }

  async findById(params: { companyId: string; id: string }): Promise<BookingRow | undefined> {
    const [row] = await this.db.select().from(bookings).where(bookingOwnedByCondition(params)).limit(1)
    return row
  }

  /** Suporta o replay de `Idempotency-Key` (T4.3) — `idx_bookings_company_idempotency` cobre a busca. */
  async findByIdempotencyKey(params: { companyId: string; idempotencyKey: string }): Promise<BookingRow | undefined> {
    const [row] = await this.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.companyId, params.companyId), eq(bookings.idempotencyKey, params.idempotencyKey)))
      .limit(1)
    return row
  }

  async findSlotsByBooking(params: { bookingId: string }): Promise<BookingSlotRow[]> {
    return this.db.select().from(bookingSlots).where(eq(bookingSlots.bookingId, params.bookingId))
  }

  /**
   * `blocking` de todo `booking_slot` do recurso que toca `[from, until)` — usado para subtrair da
   * disponibilidade calculada (spec §7). Sem filtro de status: cancelamento apaga a linha do slot
   * (T4.6), então todo `booking_slot` que sobrevive já representa reserva que ocupa a agenda.
   */
  async listBlockingSlotsByResource(params: {
    resourceId: string
    from: Date
    until: Date
  }): Promise<Array<{ blockingStart: Date; blockingEnd: Date }>> {
    return this.db
      .select({ blockingStart: bookingSlots.blockingStart, blockingEnd: bookingSlots.blockingEnd })
      .from(bookingSlots)
      .where(
        and(
          eq(bookingSlots.resourceId, params.resourceId),
          lt(bookingSlots.blockingStart, params.until),
          gt(bookingSlots.blockingEnd, params.from),
        ),
      )
  }

  async list(query: ListBookingsQuery): Promise<ListBookingsPage> {
    const conditions = [bookingListCondition(query)]
    // H-F: array de status vindo do filtro múltiplo da tela — `inArray` casa qualquer um deles.
    if (query.status && query.status.length > 0) conditions.push(inArray(bookings.status, query.status))
    if (query.from) conditions.push(gte(bookings.startsAt, query.from))
    if (query.until) conditions.push(lte(bookings.startsAt, query.until))

    const where = query.resourceId
      ? and(
          ...conditions,
          sql`exists (select 1 from ${bookingSlots} where ${bookingSlots.bookingId} = ${bookings.id} and ${bookingSlots.resourceId} = ${query.resourceId})`,
        )
      : and(...conditions)

    const sortColumn = BOOKING_SORT_COLUMNS[query.sortBy ?? 'startsAt']
    const orderBy = query.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn)

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(bookings)
        .where(where)
        .orderBy(orderBy)
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(bookings)
        .where(where),
    ])

    return { rows, total: counted?.value ?? 0 }
  }

  async updateStatus(params: {
    companyId: string
    id: string
    status: string
    values?: Partial<NewBookingRow>
  }): Promise<BookingRow | undefined> {
    const [row] = await this.db
      .update(bookings)
      .set({ ...params.values, status: params.status, updatedAt: new Date() })
      .where(bookingOwnedByCondition(params))
      .returning()
    return row
  }

  /**
   * Substitui os `booking_slots` e atualiza `startsAt`/`endsAt` na mesma transação — mesma garantia
   * do `cancelWithSlotRelease` (F-007): nunca uma reserva com slots do novo horário mas ainda com o
   * `startsAt`/`endsAt` antigo (ou vice-versa) se o processo cair no meio da remarcação.
   */
  async rescheduleWithSlotReplace(params: {
    companyId: string
    id: string
    status: string
    startsAt: Date
    endsAt: Date
    slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
  }): Promise<{ booking: BookingRow; slots: BookingSlotRow[] } | undefined> {
    try {
      return await this.db.transaction(async (tx) => {
        // A checagem de posse (`bookingOwnedByCondition`) precisa vir antes de qualquer gravação em
        // `booking_slots`: essa tabela não carrega `companyId` (herda tenancy via `bookingId`), então
        // um `delete`/`insert` de slots feito antes de confirmar a posse gravaria e commitaria a
        // troca mesmo quando `companyId` pertence a outra empresa. Update-primeiro faz o filtro por
        // tenant decidir se a transação mexe em algo — 0 linhas afetadas aqui commita uma transação
        // vazia, nunca uma troca de slot órfã.
        const [booking] = await tx
          .update(bookings)
          .set({ status: params.status, startsAt: params.startsAt, endsAt: params.endsAt, updatedAt: new Date() })
          .where(bookingOwnedByCondition(params))
          .returning()
        if (!booking) return undefined

        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, params.id))
        const slots = await tx
          .insert(bookingSlots)
          .values(params.slots.map((slot) => ({ ...slot, bookingId: params.id })))
          .returning()

        return { booking, slots }
      })
    } catch (error) {
      if (isExclusionViolation(error)) {
        const conflicting = params.slots[0]
        throw new SlotUnavailableError(conflicting?.resourceId ?? '', {
          start: conflicting?.blockingStart ?? new Date(),
          end: conflicting?.blockingEnd ?? new Date(),
        })
      }
      throw error
    }
  }

  /**
   * Reivindica lembretes devidos: `confirmed`, `reminderSentAt` nulo e `startsAt` dentro da janela
   * de antecedência (T6.1). `FOR UPDATE SKIP LOCKED` + marcação de `reminderSentAt` na mesma
   * transação é o mesmo desenho de `DispatchDueNotificationsUseCase` — duas varreduras
   * concorrentes nunca reivindicam a mesma linha (T6.2), e nenhuma trava esperando a outra.
   */
  async claimDueReminders(params: { now: Date; windowMinutes: number; limit?: number }): Promise<BookingRow[]> {
    const until = new Date(params.now.getTime() + params.windowMinutes * 60_000)

    return this.db.transaction(async (tx) => {
      // H-C: sem o piso em `params.now`, uma reserva confirmada que já começou — backlog de host
      // adotando o módulo sobre dado existente, ou cron parado por um dia — também casava "devida"
      // e disparava lembrete de compromisso que já passou, repetidamente, até a varredura esvaziar
      // a fila. "Devida" é só o que ainda não começou.
      const due = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.status, 'confirmed'),
            isNull(bookings.reminderSentAt),
            gte(bookings.startsAt, params.now),
            lte(bookings.startsAt, until),
          ),
        )
        .orderBy(asc(bookings.startsAt))
        .limit(params.limit ?? 100)
        .for('update', { skipLocked: true })

      if (due.length === 0) return []

      const ids = due.map((row) => row.id)
      await tx
        .update(bookings)
        .set({ reminderSentAt: params.now, updatedAt: params.now })
        .where(inArray(bookings.id, ids))

      return due.map((row) => ({ ...row, reminderSentAt: params.now }))
    })
  }

  /**
   * Marca `cancelled` e apaga os `booking_slots` da reserva na mesma transação — nunca uma
   * reserva sem slot mas ainda `confirmed`/`requested` se o processo cair no meio (T4.6).
   *
   * F-013: a checagem de posse precisa vir antes de qualquer gravação em `booking_slots`, mesma
   * razão do `rescheduleWithSlotReplace` (F-011) — essa tabela não carrega `companyId`. A versão
   * anterior apagava os slots primeiro; com `companyId` de outra empresa, o `delete` ainda achava
   * as linhas por `bookingId` e comitava, liberando a agenda de uma reserva que o `update`
   * seguinte rejeitava (0 linhas, retorno `undefined`) — cancelamento cross-tenant que parecia
   * não ter feito nada e na prática apagava o slot da vítima.
   */
  async cancelWithSlotRelease(params: {
    companyId: string
    id: string
    cancelledAt: Date
    cancelledBy: string
    cancellationReason?: string
  }): Promise<BookingRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: params.cancelledAt,
          cancelledBy: params.cancelledBy,
          cancellationReason: params.cancellationReason,
          updatedAt: new Date(),
        })
        .where(bookingOwnedByCondition(params))
        .returning()
      if (!row) return undefined

      await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, params.id))
      return row
    })
  }
}
