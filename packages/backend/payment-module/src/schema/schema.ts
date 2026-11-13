/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schema próprio (`pgSchema('payment')`), como os outros módulos: o host nunca versiona estas
 * tabelas, e o upgrade do pacote não vira migration do produto.
 *
 * A pessoa é `customer_ref`, texto do host (o id do usuário dele), SEM FK: outro schema, outro
 * journal, e o módulo não conhece a tabela de usuários de ninguém. Pode ser nulo: quem paga com um
 * e-mail que ainda não tem conta fica sem dono até entrar com ele.
 */

import { sql } from 'drizzle-orm'
import { index, integer, pgSchema, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const paymentSchema = pgSchema('payment')

export const subscriptions = paymentSchema.table(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `null` em single-tenant. */
    companyId: uuid('company_id'),
    customerRef: varchar('customer_ref', { length: 200 }),
    provider: varchar('provider', { length: 40 }).notNull(),
    /** Id da assinatura no provedor (na Hotmart, o código do assinante). */
    externalId: varchar('external_id', { length: 200 }).notNull(),
    customerEmail: varchar('customer_email', { length: 320 }),
    customerName: varchar('customer_name', { length: 255 }),
    planCode: varchar('plan_code', { length: 40 }).notNull(),
    offerCode: varchar('offer_code', { length: 200 }),
    paymentMethod: varchar('payment_method', { length: 20 }),
    status: varchar('status', { length: 20 }).notNull(),
    /** Até quando o último pagamento cobre. Nulo quando o provedor não informa. */
    periodEndsAt: timestamp('period_ends_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    /** Data do último evento aplicado: evento mais velho que isto não muda nada. */
    lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_subscriptions_provider_external').on(table.provider, table.externalId),
    index('idx_subscriptions_customer').on(table.companyId, table.customerRef),
    index('idx_subscriptions_email').on(sql`lower(${table.customerEmail})`),
    index('idx_subscriptions_status').on(table.companyId, table.status),
  ],
)

/**
 * Cada webhook recebido, uma vez só: a chave é o id do evento no provedor, que reenvia. Guarda só o
 * que foi traduzido — o corpo cru traz documento, telefone e endereço de quem comprou.
 */
export const paymentEvents = paymentSchema.table(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id'),
    provider: varchar('provider', { length: 40 }).notNull(),
    externalId: varchar('external_id', { length: 200 }).notNull(),
    type: varchar('type', { length: 40 }).notNull(),
    providerEventType: varchar('provider_event_type', { length: 120 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    customerRef: varchar('customer_ref', { length: 200 }),
    customerEmail: varchar('customer_email', { length: 320 }),
    offerCode: varchar('offer_code', { length: 200 }),
    transactionId: varchar('transaction_id', { length: 200 }),
    paymentMethod: varchar('payment_method', { length: 20 }),
    amountCents: integer('amount_cents'),
    currency: varchar('currency', { length: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_payment_events_provider_external').on(table.provider, table.externalId),
    index('idx_payment_events_occurred').on(table.companyId, table.occurredAt),
    index('idx_payment_events_subscription').on(table.subscriptionId),
    index('idx_payment_events_transaction').on(table.provider, table.transactionId),
  ],
)

export type SubscriptionRow = typeof subscriptions.$inferSelect
export type PaymentEventRow = typeof paymentEvents.$inferSelect
