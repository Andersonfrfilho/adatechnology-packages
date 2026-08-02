/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Default para dev e volume baixo — processa na mesma instância, sem broker. Adaptadores reais
 * (`./queue/bullmq`, `./queue/amqp`) chegam na Fase 5; nenhum consumidor sério de produção deve
 * ficar neste default (sem retenção entre restarts, sem DLQ).
 */

import type { NotificationJob, QueuePort } from '@adatechnology/notification-contracts'

type PendingJob = {
  readonly job: NotificationJob
  readonly delaySeconds?: number
}

export function createInProcessQueue(): QueuePort {
  let consumer: ((job: NotificationJob) => Promise<void>) | undefined
  const backlog: PendingJob[] = []

  return {
    async enqueue(params: { job: NotificationJob; delaySeconds?: number }): Promise<void> {
      if (!consumer) {
        backlog.push(params)
        return
      }
      if (params.delaySeconds) {
        setTimeout(() => {
          void consumer?.(params.job)
        }, params.delaySeconds * 1000)
        return
      }
      await consumer(params.job)
    },

    async consume(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
      consumer = handler
      const drained = backlog.splice(0, backlog.length)
      await Promise.all(drained.map((pending) => handler(pending.job)))
    },

    async close(): Promise<void> {
      consumer = undefined
    },
  }
}
