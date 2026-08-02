/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Adaptador BullMQ — o parque do quickcart (`bullmq` + `ioredis`). Peer opcional: quem não
 * importa este entrypoint não instala nada.
 */

import type { NotificationJob, QueuePort } from '@adatechnology/notification-contracts'

// Formas mínimas do BullMQ, declaradas por estrutura para o pacote não depender do SDK em tempo
// de tipo e para o teste injetar um dublê.
export type BullMqQueueLike = {
  add(name: string, data: NotificationJob, options?: Record<string, unknown>): Promise<unknown>
  close(): Promise<void>
}

export type BullMqWorkerLike = {
  close(): Promise<void>
}

export type CreateBullMqQueueParams = {
  readonly queue: BullMqQueueLike
  /**
   * Fábrica do Worker do BullMQ — recebida por injeção porque instanciar `new Worker(...)` exige
   * a conexão do host, e o módulo não abre conexão própria.
   */
  readonly createWorker?: (handler: (job: NotificationJob) => Promise<void>) => BullMqWorkerLike
  readonly jobName?: string
  /**
   * Retenção obrigatória em toda fila — Redis não é log (`security.md` §6). Defaults conservadores;
   * o host afrouxa se quiser inspecionar mais histórico.
   */
  readonly removeOnComplete?: number | boolean
  readonly removeOnFail?: number | boolean
  readonly attempts?: number
}

const DEFAULT_JOB_NAME = 'notification-delivery'
const DEFAULT_REMOVE_ON_COMPLETE = 1000
const DEFAULT_REMOVE_ON_FAIL = 5000

export function createBullMqQueue(params: CreateBullMqQueueParams): QueuePort {
  let worker: BullMqWorkerLike | undefined

  return {
    async enqueue({ job, delaySeconds }): Promise<void> {
      await params.queue.add(params.jobName ?? DEFAULT_JOB_NAME, job, {
        delay: delaySeconds ? delaySeconds * 1000 : undefined,
        // `attempts: 1` de propósito: o retry é decidido por `applyDeliveryOutcome`, que sabe
        // distinguir `retriable` de `permanent`. Deixar o BullMQ retentar por conta própria
        // duplicaria a política e reenviaria também o que é permanente.
        attempts: params.attempts ?? 1,
        removeOnComplete: params.removeOnComplete ?? DEFAULT_REMOVE_ON_COMPLETE,
        removeOnFail: params.removeOnFail ?? DEFAULT_REMOVE_ON_FAIL,
        // Idempotência de enfileiramento: o mesmo `deliveryId` na mesma tentativa não vira dois
        // jobs se o produtor for reexecutado.
        jobId: `${job.deliveryId}:${job.attempt}`,
      })
    },

    async consume(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
      if (!params.createWorker) {
        throw new Error('notification-module: createBullMqQueue exige `createWorker` para consumir a fila')
      }
      worker = params.createWorker(handler)
    },

    async close(): Promise<void> {
      await worker?.close()
      await params.queue.close()
    },
  }
}
