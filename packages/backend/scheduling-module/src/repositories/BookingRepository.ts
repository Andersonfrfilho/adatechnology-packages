/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { SlotUnavailableError } from '@adatechnology/scheduling-contracts'

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
  readonly status?: string
  readonly from?: Date
  readonly until?: Date
}

export type ListBookingsPage = {
  readonly rows: BookingRow[]
  readonly total: number
}

// Código Postgres para violação de `EXCLUDE` (vs. `23505`, violação de unique) — é o que a
// constraint `booking_slot_no_overlap` levanta (spec §5.2).
const POSTGRES_EXCLUSION_VIOLATION = '23P01'

// O código Postgres da constraint viola aparece em `code` na maioria dos drivers (`postgres`,
// `node-postgres`), mas o cliente SQL nativo do Bun usa `code` para o próprio erro genérico
// (`ERR_POSTGRES_SERVER_ERROR`) e guarda o código real do Postgres em `errno` — checar os dois
// mantém `BookingRepository` funcionando com qualquer driver, como o resto do módulo promete.
function hasExclusionViolationCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; errno?: unknown }
  return candidate.code === POSTGRES_EXCLUSION_VIOLATION || candidate.errno === POSTGRES_EXCLUSION_VIOLATION
}

// `drizzle-orm` embrulha o erro do driver em `DrizzleQueryError`, preservando o original em
// `.cause` (ver `drizzle-orm/errors.ts`) — o código Postgres nunca está no erro capturado
// diretamente, só na causa.
function isExclusionViolation(error: unknown): boolean {
  return (
    hasExclusionViolationCode(error) ||
    (error instanceof Error && error.cause !== undefined && hasExclusionViolationCode(error.cause))
  )
}

export class BookingRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  /**
   * Grava a reserva e um `booking_slot` por recurso na mesma transação — 1 recurso é agendamento
   * de serviço, 2+ é reunião (spec §5.1). A constraint `EXCLUDE` decide o conflito no banco, não
   * em leitura-e-depois-grava no código: dois pedidos simultâneos do mesmo horário nunca passam
   * os dois, porque não há janela entre checar e gravar.
   */
  async createWithSlots(params: {
    booking: NewBookingRow
    slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
    participants?: ReadonlyArray<Omit<NewBookingParticipantRow, 'bookingId'>>
  }): Promise<{ booking: BookingRow; slots: BookingSlotRow[] }> {
    try {
      return await this.db.transaction(async (tx) => {
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

  async findById(params: { companyId: string; id: string }): Promise<BookingRow | undefined> {
    const [row] = await this.db.select().from(bookings).where(bookingOwnedByCondition(params)).limit(1)
    return row
  }

  async findSlotsByBooking(params: { bookingId: string }): Promise<BookingSlotRow[]> {
    return this.db.select().from(bookingSlots).where(eq(bookingSlots.bookingId, params.bookingId))
  }

  async list(query: ListBookingsQuery): Promise<ListBookingsPage> {
    const conditions = [bookingListCondition(query)]
    if (query.status) conditions.push(eq(bookings.status, query.status))
    if (query.from) conditions.push(gte(bookings.startsAt, query.from))
    if (query.until) conditions.push(lte(bookings.startsAt, query.until))

    const where = query.resourceId
      ? and(
          ...conditions,
          sql`exists (select 1 from ${bookingSlots} where ${bookingSlots.bookingId} = ${bookings.id} and ${bookingSlots.resourceId} = ${query.resourceId})`,
        )
      : and(...conditions)

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(bookings)
        .where(where)
        .orderBy(asc(bookings.startsAt))
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
   * Substitui os `booking_slots` da reserva — usado por remarcação. A constraint `EXCLUDE`
   * protege o novo horário do mesmo jeito que na criação; conflito vira `SlotUnavailableError`.
   */
  async replaceSlots(params: {
    bookingId: string
    slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
  }): Promise<BookingSlotRow[]> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, params.bookingId))
        return tx
          .insert(bookingSlots)
          .values(params.slots.map((slot) => ({ ...slot, bookingId: params.bookingId })))
          .returning()
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
}
