/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória para a suíte de comportamento. O isolamento multiempresa real (cláusula SQL)
 * é coberto por `repositories/isolation.test.ts`, que renderiza SQL de verdade.
 *
 * **Limitação documentada (T2.8):** nenhum dublê aqui reproduz a constraint
 * `booking_slot_no_overlap` (`EXCLUDE USING gist`, spec §5.2) — não existe equivalente em memória
 * para um índice GIST do Postgres. `createInMemoryBookings().createWithSlots` grava o slot sem
 * checar sobreposição. Teste de conflito de horário é teste de integração contra Postgres real
 * (ver `BookingRepository`), nunca unitário contra este dublê — um dublê "inteligente" que
 * reimplementasse a checagem em JS testaria a reimplementação, não a constraint que protege
 * produção.
 */

import { randomUUID } from 'node:crypto'

import type {
  BookingParticipantRow,
  BookingRow,
  BookingSlotRow,
  NewBookingParticipantRow,
  NewBookingRow,
  NewBookingSlotRow,
  NewResourceRow,
  NewServiceRow,
  ResourceRow,
  ServiceRow,
} from '../schema/schema'

const EPOCH = new Date('2026-08-02T12:00:00.000Z')

/**
 * Leitura devolve **cópia**, não referência da linha guardada — mesmo raciocínio de
 * `catalog-module/testing/inMemoryRepositories.ts`: um `SELECT` real entrega objeto novo, e
 * comparar "antes" com "depois" só é honesto se o "antes" não mudar sozinho.
 */
function snapshot<TRow>(row: TRow | undefined): TRow | undefined {
  return row ? { ...row } : undefined
}

export function createInMemoryResources(seed: ResourceRow[] = []) {
  const rows: ResourceRow[] = [...seed]

  return {
    rows,
    async create(values: NewResourceRow): Promise<ResourceRow> {
      const row = {
        id: randomUUID(),
        externalRef: null,
        active: true,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as ResourceRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }): Promise<ResourceRow | undefined> {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id && !row.deletedAt))
    },
    async list(query: { companyId: string; page: number; pageSize: number; kind?: string; active?: boolean }) {
      const filtered = rows.filter(
        (row) =>
          row.companyId === query.companyId &&
          !row.deletedAt &&
          (query.kind ? row.kind === query.kind : true) &&
          (query.active === undefined ? true : row.active === query.active),
      )
      return {
        rows: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
      }
    },
    async update(params: {
      companyId: string
      id: string
      values: Partial<NewResourceRow>
    }): Promise<ResourceRow | undefined> {
      const row = rows.find(
        (candidate) => candidate.companyId === params.companyId && candidate.id === params.id && !candidate.deletedAt,
      )
      if (!row) return undefined
      Object.assign(row, params.values)
      return snapshot(row)
    },
    async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return false
      row.deletedAt = EPOCH
      return true
    },
  }
}

export function createInMemoryServices(seed: ServiceRow[] = []) {
  const rows: ServiceRow[] = [...seed]

  return {
    rows,
    async create(values: NewServiceRow): Promise<ServiceRow> {
      const row = {
        id: randomUUID(),
        description: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        priceInCents: null,
        requiresConfirmation: false,
        minCancellationNoticeMinutes: 0,
        active: true,
        sortOrder: 0,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as ServiceRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }): Promise<ServiceRow | undefined> {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id && !row.deletedAt))
    },
    async list(query: { companyId: string; page: number; pageSize: number; active?: boolean }) {
      const filtered = rows.filter(
        (row) =>
          row.companyId === query.companyId &&
          !row.deletedAt &&
          (query.active === undefined ? true : row.active === query.active),
      )
      return {
        rows: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
      }
    },
    async update(params: {
      companyId: string
      id: string
      values: Partial<NewServiceRow>
    }): Promise<ServiceRow | undefined> {
      const row = rows.find(
        (candidate) => candidate.companyId === params.companyId && candidate.id === params.id && !candidate.deletedAt,
      )
      if (!row) return undefined
      Object.assign(row, params.values)
      return snapshot(row)
    },
    async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return false
      row.deletedAt = EPOCH
      return true
    },
  }
}

export function createInMemoryBookings(seed: BookingRow[] = []) {
  const rows: BookingRow[] = [...seed]
  const slotsByBooking = new Map<string, BookingSlotRow[]>()
  const participantsByBooking = new Map<string, BookingParticipantRow[]>()

  return {
    rows,
    slotsByBooking,
    participantsByBooking,
    async createWithSlots(params: {
      booking: NewBookingRow
      slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
      participants?: ReadonlyArray<Omit<NewBookingParticipantRow, 'bookingId'>>
    }): Promise<{ booking: BookingRow; slots: BookingSlotRow[] }> {
      const booking = {
        id: randomUUID(),
        serviceId: null,
        customerRef: null,
        organizerRef: null,
        meetingUrl: null,
        externalCalendarId: null,
        notes: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        reminderSentAt: null,
        idempotencyKey: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...params.booking,
      } as BookingRow
      rows.push(booking)

      const slots = params.slots.map(
        (slot) => ({ id: randomUUID(), bookingId: booking.id, createdAt: EPOCH, ...slot }) as BookingSlotRow,
      )
      slotsByBooking.set(booking.id, slots)

      if (params.participants && params.participants.length > 0) {
        const participants = params.participants.map(
          (participant) =>
            ({
              id: randomUUID(),
              bookingId: booking.id,
              resourceId: null,
              responseStatus: null,
              ...participant,
            }) as BookingParticipantRow,
        )
        participantsByBooking.set(booking.id, participants)
      }

      return { booking, slots }
    },
    async findById(params: { companyId: string; id: string }): Promise<BookingRow | undefined> {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id))
    },
    async findByIdempotencyKey(params: { companyId: string; idempotencyKey: string }): Promise<BookingRow | undefined> {
      return snapshot(
        rows.find((row) => row.companyId === params.companyId && row.idempotencyKey === params.idempotencyKey),
      )
    },
    async findSlotsByBooking(params: { bookingId: string }): Promise<BookingSlotRow[]> {
      return (slotsByBooking.get(params.bookingId) ?? []).map((slot) => ({ ...slot }))
    },
    async listBlockingSlotsByResource(params: {
      resourceId: string
      from: Date
      until: Date
    }): Promise<Array<{ blockingStart: Date; blockingEnd: Date }>> {
      const blocking: Array<{ blockingStart: Date; blockingEnd: Date }> = []
      for (const slots of slotsByBooking.values()) {
        for (const slot of slots) {
          if (
            slot.resourceId === params.resourceId &&
            slot.blockingStart < params.until &&
            slot.blockingEnd > params.from
          ) {
            blocking.push({ blockingStart: slot.blockingStart, blockingEnd: slot.blockingEnd })
          }
        }
      }
      return blocking
    },
    async list(query: {
      companyId: string
      page: number
      pageSize: number
      resourceId?: string
      status?: string
      from?: Date
      until?: Date
    }): Promise<{ rows: BookingRow[]; total: number }> {
      const filtered = rows.filter((row) => {
        if (row.companyId !== query.companyId) return false
        if (query.status && row.status !== query.status) return false
        if (query.from && row.startsAt < query.from) return false
        if (query.until && row.startsAt > query.until) return false
        if (query.resourceId) {
          const slots = slotsByBooking.get(row.id) ?? []
          if (!slots.some((slot) => slot.resourceId === query.resourceId)) return false
        }
        return true
      })
      const sorted = [...filtered].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      return {
        rows: sorted.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
      }
    },
    async updateStatus(params: {
      companyId: string
      id: string
      status: string
      values?: Partial<NewBookingRow>
    }): Promise<BookingRow | undefined> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      Object.assign(row, params.values, { status: params.status })
      return snapshot(row)
    },
    async replaceSlots(params: {
      bookingId: string
      slots: ReadonlyArray<Omit<NewBookingSlotRow, 'bookingId'>>
    }): Promise<BookingSlotRow[]> {
      const slots = params.slots.map(
        (slot) => ({ id: randomUUID(), bookingId: params.bookingId, createdAt: EPOCH, ...slot }) as BookingSlotRow,
      )
      slotsByBooking.set(params.bookingId, slots)
      return slots.map((slot) => ({ ...slot }))
    },
    async cancelWithSlotRelease(params: {
      companyId: string
      id: string
      cancelledAt: Date
      cancelledBy: string
      cancellationReason?: string
    }): Promise<BookingRow | undefined> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      slotsByBooking.delete(params.id)
      Object.assign(row, {
        status: 'cancelled',
        cancelledAt: params.cancelledAt,
        cancelledBy: params.cancelledBy,
        cancellationReason: params.cancellationReason,
        updatedAt: EPOCH,
      })
      return snapshot(row)
    },
  }
}
