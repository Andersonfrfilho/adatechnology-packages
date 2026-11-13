/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Só query builder, nada de `db.execute`: o formato do resultado cru muda de driver para driver
 * (`node-postgres` devolve `{ rows }`, `bun-sql` devolve o array), e o builder é igual em todos.
 */

import { and, count, desc, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

import { SUBSCRIPTION_STATUS } from '@adatechnology/payment-contracts'
import type { PaymentMethod, Subscription, SubscriptionStatus } from '@adatechnology/payment-contracts'

import type { PaymentDatabase } from '../database.types'
import { paymentEvents, subscriptions } from '../schema/schema'
import type { SubscriptionRow } from '../schema/schema'
import type { PaymentStore } from './PaymentStore'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    companyId: row.companyId,
    customerRef: row.customerRef,
    provider: row.provider,
    externalId: row.externalId,
    customerEmail: row.customerEmail,
    planCode: row.planCode,
    offerCode: row.offerCode,
    paymentMethod: row.paymentMethod as PaymentMethod | null,
    status: row.status as SubscriptionStatus,
    periodEndsAt: row.periodEndsAt,
    canceledAt: row.canceledAt,
    lastEventAt: row.lastEventAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function sameCompany(
  column: typeof subscriptions.companyId | typeof paymentEvents.companyId,
  companyId: string | null,
): SQL {
  return companyId === null ? isNull(column) : eq(column, companyId)
}

export class DrizzlePaymentStore implements PaymentStore {
  constructor(private readonly db: PaymentDatabase) {}

  async applyEvent({ companyId, event, customerRef, decide }: Parameters<PaymentStore['applyEvent']>[0]) {
    return this.db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(paymentEvents)
        .values({
          companyId,
          provider: event.provider,
          externalId: event.eventId,
          type: event.type,
          providerEventType: event.providerEventType,
          occurredAt: event.occurredAt,
          customerRef,
          customerEmail: event.customer.email,
          offerCode: event.offerCode,
          transactionId: event.transactionId,
          paymentMethod: event.paymentMethod,
          amountCents: event.amount?.cents ?? null,
          currency: event.amount?.currency ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: paymentEvents.id })
      const eventRowId = inserted[0]?.id
      if (eventRowId === undefined) return { outcome: 'duplicate' as const }
      if (!event.subscriptionId) return { outcome: 'recorded' as const, previous: undefined, subscription: undefined }

      const found = await transaction
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.provider, event.provider), eq(subscriptions.externalId, event.subscriptionId)))
        .for('update')
        .limit(1)
      const current = found[0] ? toSubscription(found[0]) : undefined
      const decision = decide(current)
      if (!decision) {
        if (current) {
          await transaction
            .update(paymentEvents)
            .set({ subscriptionId: current.id })
            .where(eq(paymentEvents.id, eventRowId))
        }
        return { outcome: 'recorded' as const, previous: current, subscription: current }
      }

      const { status, periodEndsAt, lastEventAt } = decision.state
      const canceledAt =
        status === SUBSCRIPTION_STATUS.CANCELED
          ? (current?.canceledAt ?? event.occurredAt)
          : status === SUBSCRIPTION_STATUS.ACTIVE
            ? null
            : (current?.canceledAt ?? null)
      const values = {
        companyId: current?.companyId ?? companyId,
        customerRef: customerRef ?? current?.customerRef ?? null,
        customerEmail: event.customer.email ?? current?.customerEmail ?? null,
        customerName: event.customer.name ?? found[0]?.customerName ?? null,
        planCode: decision.planCode,
        offerCode: event.offerCode ?? current?.offerCode ?? null,
        paymentMethod: event.paymentMethod ?? current?.paymentMethod ?? null,
        status,
        periodEndsAt,
        canceledAt,
        lastEventAt,
        updatedAt: new Date(),
      }
      const [saved] = await transaction
        .insert(subscriptions)
        .values({ provider: event.provider, externalId: event.subscriptionId, ...values })
        .onConflictDoUpdate({ target: [subscriptions.provider, subscriptions.externalId], set: values })
        .returning()
      if (!saved) throw new Error('payment-module: assinatura não foi gravada')
      await transaction
        .update(paymentEvents)
        .set({ subscriptionId: saved.id, customerRef: saved.customerRef })
        .where(eq(paymentEvents.id, eventRowId))
      return { outcome: 'recorded' as const, previous: current, subscription: toSubscription(saved) }
    })
  }

  async listByCustomer({ companyId, customerRef }: Parameters<PaymentStore['listByCustomer']>[0]) {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(and(sameCompany(subscriptions.companyId, companyId), eq(subscriptions.customerRef, customerRef)))
      .orderBy(desc(subscriptions.lastEventAt))
    return rows.map(toSubscription)
  }

  async claimByEmail({ companyId, customerRef, email }: Parameters<PaymentStore['claimByEmail']>[0]) {
    const rows = await this.db
      .update(subscriptions)
      .set({ customerRef, updatedAt: new Date() })
      .where(
        and(
          sameCompany(subscriptions.companyId, companyId),
          isNull(subscriptions.customerRef),
          sql`lower(${subscriptions.customerEmail}) = ${email.toLowerCase()}`,
        ),
      )
      .returning({ id: subscriptions.id })
    return rows.length
  }

  async claimByTransaction({
    companyId,
    customerRef,
    provider,
    transactionId,
  }: Parameters<PaymentStore['claimByTransaction']>[0]) {
    return this.db.transaction(async (transaction) => {
      const [event] = await transaction
        .select({ subscriptionId: paymentEvents.subscriptionId })
        .from(paymentEvents)
        .where(
          and(
            sameCompany(paymentEvents.companyId, companyId),
            eq(paymentEvents.provider, provider),
            eq(paymentEvents.transactionId, transactionId),
            isNotNull(paymentEvents.subscriptionId),
          ),
        )
        .limit(1)
      if (!event?.subscriptionId) return undefined
      const subscriptionId = event.subscriptionId
      const [claimed] = await transaction
        .update(subscriptions)
        .set({ customerRef, updatedAt: new Date() })
        .where(and(eq(subscriptions.id, subscriptionId), isNull(subscriptions.customerRef)))
        .returning()
      if (claimed) {
        await transaction
          .update(paymentEvents)
          .set({ customerRef })
          .where(and(eq(paymentEvents.subscriptionId, subscriptionId), isNull(paymentEvents.customerRef)))
        return toSubscription(claimed)
      }
      const [owned] = await transaction
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.customerRef, customerRef)))
        .limit(1)
      return owned ? toSubscription(owned) : undefined
    })
  }

  async markCanceled({ id, at }: Parameters<PaymentStore['markCanceled']>[0]) {
    await this.db
      .update(subscriptions)
      .set({ status: SUBSCRIPTION_STATUS.CANCELED, canceledAt: at, updatedAt: at })
      .where(eq(subscriptions.id, id))
  }

  async overview({ companyId, now, pastDueGraceMs }: Parameters<PaymentStore['overview']>[0]) {
    const since = new Date(now.getTime() - THIRTY_DAYS_MS)
    const graceLimit = new Date(now.getTime() - pastDueGraceMs)
    const scope = sameCompany(subscriptions.companyId, companyId)
    const eventScope = sameCompany(paymentEvents.companyId, companyId)
    const approvedSince = and(
      eventScope,
      eq(paymentEvents.type, 'payment_approved'),
      gte(paymentEvents.occurredAt, since),
    )
    const [byStatus, byPlan, revenue, methods, unlinked] = await Promise.all([
      this.db
        .select({ status: subscriptions.status, count: count() })
        .from(subscriptions)
        .where(scope)
        .groupBy(subscriptions.status),
      this.db
        .select({ planCode: subscriptions.planCode, count: count() })
        .from(subscriptions)
        .where(
          and(
            scope,
            or(
              eq(subscriptions.status, SUBSCRIPTION_STATUS.ACTIVE),
              and(
                eq(subscriptions.status, SUBSCRIPTION_STATUS.PAST_DUE),
                or(isNull(subscriptions.periodEndsAt), sql`${subscriptions.periodEndsAt} > ${graceLimit}`),
              ),
              and(eq(subscriptions.status, SUBSCRIPTION_STATUS.CANCELED), sql`${subscriptions.periodEndsAt} > ${now}`),
            ),
          ),
        )
        .groupBy(subscriptions.planCode)
        .orderBy(desc(count())),
      this.db
        .select({
          currency: paymentEvents.currency,
          cents: sql<string>`coalesce(sum(${paymentEvents.amountCents}), 0)`,
          payments: count(),
        })
        .from(paymentEvents)
        .where(and(approvedSince, sql`${paymentEvents.currency} is not null`))
        .groupBy(paymentEvents.currency),
      this.db
        .select({ paymentMethod: paymentEvents.paymentMethod, payments: count() })
        .from(paymentEvents)
        .where(approvedSince)
        .groupBy(paymentEvents.paymentMethod),
      this.db
        .select({ count: count() })
        .from(subscriptions)
        .where(and(scope, isNull(subscriptions.customerRef))),
    ])
    return {
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.count)])),
      withAccessByPlan: byPlan.map((row) => ({ planCode: row.planCode, count: Number(row.count) })),
      revenue30d: revenue.map((row) => ({
        currency: row.currency ?? '',
        cents: Number(row.cents),
        payments: Number(row.payments),
      })),
      methods30d: methods.map((row) => ({
        paymentMethod: row.paymentMethod ?? 'other',
        payments: Number(row.payments),
      })),
      unlinked: Number(unlinked[0]?.count ?? 0),
    }
  }

  async listSubscriptions({
    companyId,
    page,
    perPage,
    status,
    search,
  }: Parameters<PaymentStore['listSubscriptions']>[0]) {
    const like = search ? `%${search.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%` : undefined
    const where = and(
      sameCompany(subscriptions.companyId, companyId),
      status ? eq(subscriptions.status, status) : undefined,
      like
        ? or(
            sql`lower(coalesce(${subscriptions.customerEmail}, '')) like ${like}`,
            sql`lower(coalesce(${subscriptions.customerName}, '')) like ${like}`,
          )
        : undefined,
    )
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(subscriptions)
        .where(where)
        .orderBy(desc(subscriptions.lastEventAt))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ count: count() }).from(subscriptions).where(where),
    ])
    return { rows: rows.map(toSubscription), total: Number(total[0]?.count ?? 0) }
  }

  async listEvents({ companyId, page, perPage }: Parameters<PaymentStore['listEvents']>[0]) {
    const where = sameCompany(paymentEvents.companyId, companyId)
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(paymentEvents)
        .where(where)
        .orderBy(desc(paymentEvents.occurredAt))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ count: count() }).from(paymentEvents).where(where),
    ])
    return {
      rows: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        type: row.type,
        providerEventType: row.providerEventType,
        occurredAt: row.occurredAt,
        customerRef: row.customerRef,
        customerEmail: row.customerEmail,
        paymentMethod: row.paymentMethod as PaymentMethod | null,
        amountCents: row.amountCents,
        currency: row.currency,
      })),
      total: Number(total[0]?.count ?? 0),
    }
  }
}
