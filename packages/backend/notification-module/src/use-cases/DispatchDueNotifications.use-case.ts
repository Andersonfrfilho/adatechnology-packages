/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cron sugerido: a cada minuto. Duas fases deliberadamente separadas:
 *
 * 1. Uma transação curta reivindica as linhas com `SELECT ... FOR UPDATE SKIP LOCKED` e já marca
 *    `status = 'queued'` antes de soltar o lock — é o que faz duas instâncias do cron rodando ao
 *    mesmo tempo nunca disparar a mesma notificação duas vezes (`SKIP LOCKED` faz a segunda
 *    instância simplesmente pular a linha que a primeira já travou, em vez de esperar por ela).
 * 2. O disparo de fato (`dispatchNow`, que resolve destinatário e chama driver) acontece DEPOIS
 *    do commit, fora da transação — segurar um lock de linha durante I/O de rede é o tipo de
 *    coisa que trava o banco inteiro se o provedor externo demorar.
 *
 * `status IN ('pending', 'scheduled')`: `scheduled` é o caminho normal (agendamento explícito);
 * `pending` é uma rede de segurança — se o processo caiu entre `SendNotification` inserir a
 * notificação e chamar `dispatchNow`, ela fica `pending` para sempre sem este cron.
 */

import { and, asc, inArray, isNull, lte, or } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { notifications, type NotificationRow } from '../schema/schema'
import type { SendNotificationUseCase } from './SendNotification.use-case'

export type DispatchDueNotificationsDependencies = {
  readonly db: NotificationDatabase
  readonly sendNotification: SendNotificationUseCase
  readonly clock?: { now(): Date }
  readonly logger?: { warn(message: string, meta?: Record<string, unknown>): void }
}

const DEFAULT_BATCH_LIMIT = 100

export class DispatchDueNotificationsUseCase {
  constructor(private readonly dependencies: DispatchDueNotificationsDependencies) {}

  async execute(params: { limit?: number } = {}): Promise<{ processed: number; failed: number }> {
    const now = this.dependencies.clock?.now() ?? new Date()
    const limit = params.limit ?? DEFAULT_BATCH_LIMIT

    const claimed = await this.dependencies.db.transaction(async (tx) => {
      const dueRows = await tx
        .select()
        .from(notifications)
        .where(
          and(
            inArray(notifications.status, ['pending', 'scheduled']),
            or(isNull(notifications.scheduledFor), lte(notifications.scheduledFor, now)),
          ),
        )
        .orderBy(asc(notifications.createdAt))
        .limit(limit)
        .for('update', { skipLocked: true })

      if (dueRows.length === 0) return [] as NotificationRow[]

      const ids = dueRows.map((row) => row.id)
      await tx.update(notifications).set({ status: 'queued', updatedAt: now }).where(inArray(notifications.id, ids))
      return dueRows
    })

    if (claimed.length === 0) return { processed: 0, failed: 0 }

    const results = await Promise.allSettled(
      claimed.map((notification) => this.dependencies.sendNotification.dispatchNow({ notification })),
    )

    const failed = results.filter((result) => result.status === 'rejected')
    for (const failure of failed) {
      if (failure.status === 'rejected') {
        this.dependencies.logger?.warn('notification.dispatch_due.failed', { error: String(failure.reason) })
      }
    }

    return { processed: claimed.length, failed: failed.length }
  }
}
