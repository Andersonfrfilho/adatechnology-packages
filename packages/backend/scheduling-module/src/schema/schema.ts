/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `booking_slots.during`/`.blocking` como `tstzrange` gerado, o índice GIST e a constraint
 * `EXCLUDE` (spec §5.2) não têm representação nativa no drizzle-kit — eles nascem só na migration
 * hand-escrita (T2.3/T2.4), não aqui. Este schema declara as colunas de limite
 * (`duringStart`/`duringEnd`/`blockingStart`/`blockingEnd`) que o repositório de fato lê e
 * escreve; os ranges derivados são detalhe de constraint, não de query da aplicação.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host (regra §3).
export const schedulingSchema = pgSchema('scheduling')

// varchar em vez de ENUM nativo (`code-standart.md` §8); os valores espelham os `const object` do
// `@adatechnology/scheduling-contracts`, sem o schema importar o runtime dele.
const COMPANY_ID = uuid('company_id').notNull()

export const resources = schedulingSchema.table(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    name: varchar('name', { length: 160 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    // IANA, ex. `America/Sao_Paulo` — no recurso, não na empresa (spec §5.3): duas salas da mesma
    // empresa em fusos diferentes têm expediente próprio.
    timezone: varchar('timezone', { length: 64 }).notNull(),
    // Referência opaca do produto (profissional, equipe) — nunca dado pessoal (spec §6).
    externalRef: varchar('external_ref', { length: 160 }),
    active: boolean('active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_resources_company_active').on(table.companyId, table.active),
    index('idx_resources_company_kind').on(table.companyId, table.kind),
    // L-011 (T9.3): alvo da FK composta de `resource_services` — sem ela, nada no banco impede um
    // `resource_services.company_id` divergente do `resources.company_id` do recurso vinculado.
    uniqueIndex('idx_resources_id_company').on(table.id, table.companyId),
  ],
)

export const services = schedulingSchema.table(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    // Tempo reservado antes/depois do horário visível ao cliente — troca de sala, higienização,
    // deslocamento. Entra em `booking_slots.blocking`, nunca em `during` (spec §5.1).
    bufferBeforeMinutes: integer('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    // Centavos inteiros — mesma regra de `catalog-module`. `null` = serviço sem preço fixo.
    priceInCents: integer('price_in_cents'),
    requiresConfirmation: boolean('requires_confirmation').notNull().default(false),
    // `0` desliga a janela mínima de cancelamento.
    minCancellationNoticeMinutes: integer('min_cancellation_notice_minutes').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_services_company_active').on(table.companyId, table.active, table.sortOrder),
    // L-011 (T9.3): alvo da FK composta de `resource_services` (mesmo motivo de `idx_resources_id_company`).
    uniqueIndex('idx_services_id_company').on(table.id, table.companyId),
  ],
)

// Junção: quais recursos atendem qual serviço — filtra a fatia de disponibilidade (spec §7).
// Sem `id` próprio: a chave é o par, e duplicar o vínculo não tem significado de negócio.
export const resourceServices = schedulingSchema.table(
  'resource_services',
  {
    companyId: COMPANY_ID,
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_resource_services_pair').on(table.resourceId, table.serviceId),
    index('idx_resource_services_company_service').on(table.companyId, table.serviceId),
    // L-011 (T9.3): antes desta constraint, tenancy do vínculo dependia só de
    // `assertServiceAndResourceOwned` na camada de aplicação — nada no banco impedia um
    // `resource_services` gravado (ou corrompido) com `company_id` diferente do recurso/serviço.
    foreignKey({
      columns: [table.resourceId, table.companyId],
      foreignColumns: [resources.id, resources.companyId],
      name: 'resource_services_resource_company_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.serviceId, table.companyId],
      foreignColumns: [services.id, services.companyId],
      name: 'resource_services_service_company_fk',
    }).onDelete('cascade'),
  ],
)

export const availabilityRules = schedulingSchema.table(
  'availability_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    // 0 = domingo … 6 = sábado.
    weekday: smallint('weekday').notNull(),
    // Hora de parede `HH:mm`, nunca convertida para UTC no cadastro — o fuso vive em
    // `resources.timezone` e a conversão acontece só no cálculo de disponibilidade em leitura
    // (spec §5.3, DST-safety).
    startsAtLocal: varchar('starts_at_local', { length: 5 }).notNull(),
    endsAtLocal: varchar('ends_at_local', { length: 5 }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_availability_rules_resource_weekday').on(table.resourceId, table.weekday)],
)

export const availabilityExceptions = schedulingSchema.table(
  'availability_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    duringStart: timestamp('during_start', { withTimezone: true }).notNull(),
    duringEnd: timestamp('during_end', { withTimezone: true }).notNull(),
    // 'block' | 'extra' — bloqueia ou libera horário fora da regra semanal (spec §7).
    kind: varchar('kind', { length: 8 }).notNull(),
    reason: varchar('reason', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Índice btree de apoio; o índice GIST sobre o range `during` gerado entra na migration
    // hand-escrita (T2.4), porque a coluna de range também nasce lá.
    index('idx_availability_exceptions_resource_during').on(table.resourceId, table.duringStart, table.duringEnd),
  ],
)

export const bookings = schedulingSchema.table(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    // Ausente = reunião ad-hoc sem serviço catalogado (spec §2).
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    // 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'.
    status: varchar('status', { length: 16 }).notNull(),
    // Resumo de leitura para ordenar/filtrar a listagem sem juntar `booking_slots` — nunca a faixa
    // protegida contra sobreposição, que vive por recurso em `booking_slots` (spec §5.1).
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    // Referências opacas — nome, telefone e e-mail ficam no produto (spec §6).
    customerRef: varchar('customer_ref', { length: 160 }),
    organizerRef: varchar('organizer_ref', { length: 160 }),
    meetingUrl: text('meeting_url'),
    externalCalendarId: varchar('external_calendar_id', { length: 160 }),
    notes: text('notes'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: varchar('cancelled_by', { length: 160 }),
    cancellationReason: varchar('cancellation_reason', { length: 500 }),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    // Chave de idempotência do `POST /bookings` (`apis.md`) — viaja em header, não em corpo.
    idempotencyKey: varchar('idempotency_key', { length: 160 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_bookings_company_status_starts').on(table.companyId, table.status, table.startsAt),
    uniqueIndex('idx_bookings_company_idempotency')
      .on(table.companyId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
)

// Uma linha por recurso consumido — 1 linha é agendamento de serviço, 2+ é reunião (spec §5.1).
// É esta tabela, não `bookings`, que a constraint `EXCLUDE` protege por recurso.
export const bookingSlots = schedulingSchema.table(
  'booking_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'restrict' }),
    // Contrato com o cliente — o que a ponta pública mostra.
    duringStart: timestamp('during_start', { withTimezone: true }).notNull(),
    duringEnd: timestamp('during_end', { withTimezone: true }).notNull(),
    // `during` mais os buffers do serviço — o que a constraint `EXCLUDE` protege (spec §5.2).
    blockingStart: timestamp('blocking_start', { withTimezone: true }).notNull(),
    blockingEnd: timestamp('blocking_end', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_booking_slots_resource').on(table.resourceId, table.duringStart)],
)

export const bookingParticipants = schedulingSchema.table(
  'booking_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    participantRef: varchar('participant_ref', { length: 160 }).notNull(),
    // Ausente = participante sem agenda própria no módulo (ex.: cliente externo).
    resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
    // 'organizer' | 'attendee'.
    role: varchar('role', { length: 16 }).notNull(),
    // 'pending' | 'accepted' | 'declined'; `null` = papel não usa RSVP (ex.: cliente do serviço).
    responseStatus: varchar('response_status', { length: 16 }),
  },
  (table) => [index('idx_booking_participants_booking').on(table.bookingId)],
)

export type ResourceRow = typeof resources.$inferSelect
export type NewResourceRow = typeof resources.$inferInsert

export type ServiceRow = typeof services.$inferSelect
export type NewServiceRow = typeof services.$inferInsert

export type ResourceServiceRow = typeof resourceServices.$inferSelect
export type NewResourceServiceRow = typeof resourceServices.$inferInsert

export type AvailabilityRuleRow = typeof availabilityRules.$inferSelect
export type NewAvailabilityRuleRow = typeof availabilityRules.$inferInsert

export type AvailabilityExceptionRow = typeof availabilityExceptions.$inferSelect
export type NewAvailabilityExceptionRow = typeof availabilityExceptions.$inferInsert

export type BookingRow = typeof bookings.$inferSelect
export type NewBookingRow = typeof bookings.$inferInsert

export type BookingSlotRow = typeof bookingSlots.$inferSelect
export type NewBookingSlotRow = typeof bookingSlots.$inferInsert

export type BookingParticipantRow = typeof bookingParticipants.$inferSelect
export type NewBookingParticipantRow = typeof bookingParticipants.$inferInsert
