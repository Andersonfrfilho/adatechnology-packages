/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { Options } from 'amqplib'

export type RabbitMqConnectionConfig = string | Options.Connect

export type RabbitMqRoute = {
  readonly exchange: string
  readonly queue: string
  readonly routingKey: string
}

export type RabbitMqRetryRoute = RabbitMqRoute & {
  readonly delayMs: number
  readonly maxRetries: number
}

export type RabbitMqTopology = RabbitMqRoute & {
  readonly retry: RabbitMqRetryRoute
  readonly deadLetter: RabbitMqRoute
}

export type RabbitMqProviderConfig = {
  readonly connection: RabbitMqConnectionConfig
  readonly topology: RabbitMqTopology
}

export type RabbitMqDisposition =
  | { readonly type: 'ack' }
  | { readonly type: 'retry' }
  | { readonly type: 'dead-letter' }

export type RabbitMqConsumerMessage<TPayload> = {
  readonly payload: TPayload
  readonly headers: Readonly<Record<string, unknown>>
  readonly messageId?: string
  readonly correlationId?: string
  readonly redelivered: boolean
  readonly retryCount: number
}

export type RabbitMqMessageHandler<TPayload> = (
  message: RabbitMqConsumerMessage<TPayload>,
) => RabbitMqDisposition | Promise<RabbitMqDisposition>

export type RabbitMqMessageDecoder<TPayload> = (value: unknown) => TPayload

export type RabbitMqConsumeParams<TPayload> = {
  readonly decode: RabbitMqMessageDecoder<TPayload>
  readonly handler: RabbitMqMessageHandler<TPayload>
  readonly prefetch: number
  readonly consumerTag?: string
}

export type RabbitMqConsumer = {
  readonly consumerTag: string
  cancel(): Promise<void>
}

export type RabbitMqPublishOptions = {
  readonly headers?: Readonly<Record<string, unknown>>
  readonly messageId?: string
  readonly correlationId?: string
  readonly type?: string
}

export type RabbitMqProviderHealth = {
  readonly healthy: true
}

export type RabbitMqProvider = {
  publish<TPayload>(payload: TPayload, options?: RabbitMqPublishOptions): Promise<void>
  consume<TPayload>(params: RabbitMqConsumeParams<TPayload>): Promise<RabbitMqConsumer>
  healthCheck(): Promise<RabbitMqProviderHealth>
  close(): Promise<void>
}
