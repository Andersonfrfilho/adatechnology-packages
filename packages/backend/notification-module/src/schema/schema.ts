/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve em `public`, só ocupa este namespace próprio
// dentro do banco do host (regra de módulos plugáveis §3, "Isolamento de Tabelas").
export const notificationSchema = pgSchema('notification')

// varchar em vez de ENUM nativo (`code-standart.md` §8) — os valores espelham os `const object`
// de `@adatechnology/notification-contracts`; o pacote não importa aquele módulo aqui para não
// acoplar o schema Drizzle ao runtime do contracts.
const CHANNEL = varchar('channel', { length: 16 })
const COMPANY_ID = uuid('company_id').notNull()

export const templates = notificationSchema.table(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    key: varchar('key', { length: 128 }).notNull(),
    channel: CHANNEL.notNull(),
    locale: varchar('locale', { length: 16 }).notNull(),
    version: integer('version').notNull().default(1),
    subject: varchar('subject', { length: 256 }),
    body: text('body').notNull(),
    // Nome do template aprovado na Meta. Sem ele, o canal WhatsApp é pulado fora da janela de
    // 24h em vez de estourar erro (spec §10.7) — é por isso que a coluna é opcional mesmo em
    // linhas de canal `whatsapp`.
    whatsappTemplateName: varchar('whatsapp_template_name', { length: 128 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_templates_identity').on(table.companyId, table.key, table.channel, table.locale, table.version),
  ],
)

export const notifications = notificationSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    recipientUserId: uuid('recipient_user_id').notNull(),
    // varchar livre, não enum — categoria é vocabulário de negócio do produto (decisão Q2 da
    // spec); fechá-la aqui obrigaria uma major do pacote a cada produto novo.
    category: varchar('category', { length: 64 }).notNull(),
    templateKey: varchar('template_key', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    title: varchar('title', { length: 256 }).notNull(),
    body: text('body').notNull(),
    // Chave de negócio da entrega (spec §10.3) — repetição do mesmo dedupeKey devolve a
    // notificação já criada em vez de duplicar o envio.
    dedupeKey: varchar('dedupe_key', { length: 256 }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    readAt: timestamp('read_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Único por empresa e só quando dedupeKey existe — parcial, porque a maioria dos envios
    // pontuais (broadcast manual, teste) não tem chave de negócio nenhuma para deduplicar.
    uniqueIndex('idx_notifications_dedupe')
      .on(table.companyId, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    index('idx_notifications_inbox').on(table.companyId, table.recipientUserId, table.readAt),
    index('idx_notifications_due').on(table.status, table.scheduledFor),
  ],
)

export const deliveries = notificationSchema.table(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id),
    // Denormalizado: toda leitura de delivery é sempre escopada por empresa também, e evita um
    // join com `notifications` só para filtrar tenant (mesmo padrão de `messages.companyId` em
    // `meta-whatsapp-module`).
    companyId: COMPANY_ID,
    channel: CHANNEL.notNull(),
    driver: varchar('driver', { length: 32 }),
    // Nunca o endereço em claro — `****1234` / `a***@dominio.com` (LGPD, spec §5).
    targetMasked: varchar('target_masked', { length: 128 }),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    attempt: integer('attempt').notNull().default(0),
    providerMessageId: varchar('provider_message_id', { length: 256 }),
    errorCode: varchar('error_code', { length: 64 }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_deliveries_notification').on(table.notificationId),
    index('idx_deliveries_company_status').on(table.companyId, table.status, table.createdAt),
    // Correlaciona o recibo assíncrono (bounce/complaint/delivered) com a delivery que o
    // originou. Não escopado por companyId de propósito — o webhook chega só com o id que o
    // provedor emitiu, e é esta busca que descobre a empresa (ver DeliveryRepository).
    index('idx_deliveries_provider_message').on(table.channel, table.providerMessageId),
  ],
)

export const devices = notificationSchema.table(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    userId: uuid('user_id').notNull(),
    platform: varchar('platform', { length: 16 }).notNull(),
    driver: varchar('driver', { length: 16 }).notNull(),
    token: text('token').notNull(),
    appVersion: varchar('app_version', { length: 32 }),
    locale: varchar('locale', { length: 16 }),
    timezone: varchar('timezone', { length: 64 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledReason: varchar('disabled_reason', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Um token só pode apontar para um dispositivo — reinstalar o app reatribui o token
    // existente em vez de duplicar linha (RegisterDevice é idempotente por isto).
    uniqueIndex('idx_devices_driver_token').on(table.driver, table.token),
    index('idx_devices_company_user').on(table.companyId, table.userId, table.disabledAt),
  ],
)

export const preferences = notificationSchema.table(
  'preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    userId: uuid('user_id').notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    channel: CHANNEL.notNull(),
    enabled: boolean('enabled').notNull().default(true),
    // `HH:mm` no timezone da própria linha; ambos ausentes = sem janela de silêncio.
    quietHoursStart: varchar('quiet_hours_start', { length: 5 }),
    quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
    timezone: varchar('timezone', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_preferences_identity').on(table.companyId, table.userId, table.category, table.channel)],
)

export const suppressions = notificationSchema.table(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: COMPANY_ID,
    channel: CHANNEL.notNull(),
    // HMAC do endereço, nunca o endereço — confere supressão sem armazenar o dado (spec §5).
    targetHash: varchar('target_hash', { length: 128 }).notNull(),
    reason: varchar('reason', { length: 16 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_suppressions_identity').on(table.companyId, table.channel, table.targetHash)],
)

export type TemplateRow = typeof templates.$inferSelect
export type NewTemplateRow = typeof templates.$inferInsert

export type NotificationRow = typeof notifications.$inferSelect
export type NewNotificationRow = typeof notifications.$inferInsert

export type DeliveryRow = typeof deliveries.$inferSelect
export type NewDeliveryRow = typeof deliveries.$inferInsert

export type DeviceRow = typeof devices.$inferSelect
export type NewDeviceRow = typeof devices.$inferInsert

export type PreferenceRow = typeof preferences.$inferSelect
export type NewPreferenceRow = typeof preferences.$inferInsert

export type SuppressionRow = typeof suppressions.$inferSelect
export type NewSuppressionRow = typeof suppressions.$inferInsert
