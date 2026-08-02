/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Adaptador AMQP — o parque do template `micro-backend-uws` (`amqplib`). Peer opcional.
 */

import type { NotificationJob, QueuePort } from '@adatechnology/notification-contracts'

// Forma mínima do canal do `amqplib`, declarada por estrutura (o pacote não depende do SDK em
// tempo de tipo, e o teste injeta um dublê).
export type AmqpChannelLike = {
  assertQueue(queue: string, options?: Record<string, unknown>): Promise<unknown>
  sendToQueue(queue: string, content: Uint8Array, options?: Record<string, unknown>): boolean
  consume(
    queue: string,
    onMessage: (message: AmqpMessageLike | null) => void,
    options?: Record<string, unknown>,
  ): Promise<unknown>
  ack(message: AmqpMessageLike): void
  nack(message: AmqpMessageLike, allUpTo?: boolean, requeue?: boolean): void
  close(): Promise<void>
}

export type AmqpMessageLike = {
  content: Uint8Array
}

export type CreateAmqpQueueParams = {
  readonly channel: AmqpChannelLike
  readonly queueName: string
  /** Fila de descarte para o que falhar no parse — sem ela, mensagem corrompida volta em loop. */
  readonly deadLetterExchange?: string
  readonly logger?: { warn(message: string, meta?: Record<string, unknown>): void }
}

export function createAmqpQueue(params: CreateAmqpQueueParams): QueuePort {
  const assertQueue = params.channel.assertQueue(params.queueName, {
    durable: true,
    deadLetterExchange: params.deadLetterExchange,
  })

  return {
    async enqueue({ job, delaySeconds }): Promise<void> {
      await assertQueue
      params.channel.sendToQueue(params.queueName, new TextEncoder().encode(JSON.stringify(job)), {
        persistent: true,
        // AMQP puro não tem delay nativo; `x-delay` só funciona com o plugin
        // rabbitmq-delayed-message-exchange. Sem ele, o broker entrega imediatamente e o
        // reagendamento por backoff perde o atraso — documentado para o host saber que precisa
        // do plugin se usar quiet hours ou retry com espera.
        headers: delaySeconds ? { 'x-delay': delaySeconds * 1000 } : undefined,
      })
    },

    async consume(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
      await assertQueue
      await params.channel.consume(params.queueName, (message) => {
        if (!message) return

        let job: NotificationJob
        try {
          job = JSON.parse(new TextDecoder().decode(message.content)) as NotificationJob
        } catch (error) {
          // Payload irrecuperável: `requeue: false` manda para a DLQ em vez de girar para sempre.
          params.logger?.warn('notification.amqp.invalid_payload', { error: String(error) })
          params.channel.nack(message, false, false)
          return
        }

        void handler(job)
          .then(() => params.channel.ack(message))
          .catch((error: unknown) => {
            // O retry é do módulo (`applyDeliveryOutcome`), não do broker — por isso `ack` mesmo
            // em falha: reentregar aqui duplicaria a política de retry.
            params.logger?.warn('notification.amqp.handler_failed', { error: String(error) })
            params.channel.ack(message)
          })
      })
    },

    async close(): Promise<void> {
      await params.channel.close()
    },
  }
}
