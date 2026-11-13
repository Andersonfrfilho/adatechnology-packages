/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Worker e descritores de cron. O host registra os `schedules` no agendador dele — o módulo não
 * escolhe biblioteca de cron nem abre timer próprio.
 */

import type { LoggerPort, NotificationJob, QueuePort } from '@adatechnology/notification-contracts'

import type { NotificationModule } from './NotificationModule'

export type NotificationWorker = {
  start(): Promise<void>
  stop(): Promise<void>
}

export type CreateNotificationWorkerParams = {
  readonly module: NotificationModule
  readonly queue: QueuePort
  readonly logger?: LoggerPort
}

export function createNotificationWorker(params: CreateNotificationWorkerParams): NotificationWorker {
  return {
    async start(): Promise<void> {
      await params.queue.consume(async (job: NotificationJob) => {
        try {
          await params.module.useCases.dispatchDelivery.execute(job)
        } catch (error) {
          // O use-case já converte falha de driver em `delivery.status`; chegar exceção aqui é
          // defeito de infraestrutura (banco fora, por exemplo). Loga e deixa o job terminar —
          // reprocessar cegamente arriscaria entrega dupla, e a delivery segue `queued` para o
          // `retry-stuck` recuperar.
          params.logger?.error('notification.worker.dispatch_failed', {
            deliveryId: job.deliveryId,
            error: String(error),
          })
        }
      })
    },

    async stop(): Promise<void> {
      await params.queue.close()
    },
  }
}

export type NotificationSchedule = {
  readonly name: string
  readonly cronExpression: string
  run(): Promise<void>
}

/**
 * `retry-stuck` não existe ainda como use-case próprio: `dispatchDueNotifications` já recupera
 * notificação parada em `pending`/`scheduled`, que é o caso real de processo derrubado no meio.
 * Uma delivery presa em `queued` com o job perdido precisaria de varredura por `updatedAt` —
 * fica para quando houver evidência de que acontece (não inventar operação de manutenção antes
 * do problema aparecer).
 */
export function createNotificationSchedules(module: NotificationModule): NotificationSchedule[] {
  return [
    {
      name: 'notification:dispatch-due',
      cronExpression: '* * * * *',
      async run(): Promise<void> {
        await module.useCases.dispatchDueNotifications.execute()
      },
    },
    {
      name: 'notification:purge-expired',
      cronExpression: '0 4 * * *',
      async run(): Promise<void> {
        await module.useCases.purgeExpiredNotifications.execute()
      },
    },
  ]
}
