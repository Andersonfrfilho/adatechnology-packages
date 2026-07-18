/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { Channel, ChannelModel, ConfirmChannel, ConsumeMessage, MessagePropertyHeaders, Options } from 'amqplib'

import { RabbitMqConfigurationError, RabbitMqProviderClosedError } from './rabbitmq-provider.error'
import type {
  RabbitMqConsumeParams,
  RabbitMqConsumer,
  RabbitMqConsumerMessage,
  RabbitMqDisposition,
  RabbitMqProvider,
  RabbitMqProviderHealth,
  RabbitMqPublishOptions,
  RabbitMqTopology,
} from './rabbitmq-provider.types'

type RabbitMqProviderServiceParams = {
  readonly connection: ChannelModel
  readonly publisherChannel: ConfirmChannel
  readonly topology: RabbitMqTopology
}

type ConsumerState = {
  readonly channel: Channel
  readonly inFlight: Set<Promise<void>>
  cancellation?: Promise<void>
}

export class RabbitMqProviderService implements RabbitMqProvider {
  private readonly connection: ChannelModel
  private readonly publisherChannel: ConfirmChannel
  private readonly topology: RabbitMqTopology
  private readonly consumers = new Map<string, ConsumerState>()
  private readonly openingConsumerChannels = new Set<Channel>()
  private closePromise: Promise<void> | undefined
  private closing = false

  constructor({ connection, publisherChannel, topology }: RabbitMqProviderServiceParams) {
    this.connection = connection
    this.publisherChannel = publisherChannel
    this.topology = topology
  }

  async publish<TPayload>(payload: TPayload, options: RabbitMqPublishOptions = {}): Promise<void> {
    this.assertOpen()
    await this.publishConfirmed({
      content: Buffer.from(JSON.stringify(payload)),
      exchange: this.topology.exchange,
      options: {
        ...options,
        contentType: 'application/json',
        persistent: true,
      },
      routingKey: this.topology.routingKey,
    })
  }

  async consume<TPayload>({
    decode,
    handler,
    prefetch,
    consumerTag,
  }: RabbitMqConsumeParams<TPayload>): Promise<RabbitMqConsumer> {
    this.assertOpen()
    assertValidPrefetch(prefetch)

    const channel = await this.connection.createChannel()
    const inFlight = new Set<Promise<void>>()
    this.openingConsumerChannels.add(channel)

    try {
      this.assertOpen()
      await channel.prefetch(prefetch)
      this.assertOpen()

      const reply = await channel.consume(
        this.topology.queue,
        (message) => {
          if (!message) {
            return
          }

          const processing = this.processDelivery({
            channel,
            decode,
            handler,
            message,
          })
          inFlight.add(processing)
          void processing.then(
            () => inFlight.delete(processing),
            () => inFlight.delete(processing),
          )
        },
        {
          consumerTag,
          noAck: false,
        },
      )

      this.assertOpen()
      this.openingConsumerChannels.delete(channel)
      this.consumers.set(reply.consumerTag, { channel, inFlight })

      return {
        consumerTag: reply.consumerTag,
        cancel: () => this.cancelConsumer(reply.consumerTag),
      }
    } catch (error: unknown) {
      this.openingConsumerChannels.delete(channel)
      await closeChannel(channel)
      throw error
    }
  }

  async healthCheck(): Promise<RabbitMqProviderHealth> {
    this.assertOpen()
    await this.publisherChannel.checkQueue(this.topology.queue)
    return { healthy: true }
  }

  close(): Promise<void> {
    this.closePromise ??= this.shutdown()
    return this.closePromise
  }

  private async processDelivery<TPayload>({
    channel,
    decode,
    handler,
    message,
  }: ProcessDeliveryParams<TPayload>): Promise<void> {
    const decoded = decodeDelivery<TPayload>({
      decode,
      message,
      retryQueue: this.topology.retry.queue,
    })

    if (!decoded) {
      channel.reject(message, false)
      return
    }

    try {
      const disposition = await handler(decoded)
      await this.applyDisposition({
        channel,
        disposition,
        message,
        retryCount: decoded.retryCount,
      })
    } catch {
      await this.handleFailure({ channel, message, metadata: decoded })
    }
  }

  private async applyDisposition({ channel, disposition, message, retryCount }: ApplyDispositionParams): Promise<void> {
    if (disposition.type === 'ack') {
      channel.ack(message)
      return
    }

    if (disposition.type === 'dead-letter') {
      channel.reject(message, false)
      return
    }

    if (retryCount >= this.topology.retry.maxRetries) {
      channel.reject(message, false)
      return
    }

    await this.publishRetry({ channel, message, retryCount })
  }

  private async handleFailure({ channel, message, metadata }: HandleFailureParams): Promise<void> {
    if (metadata.retryCount === 0 && !metadata.redelivered) {
      channel.nack(message, false, true)
      return
    }

    if (metadata.retryCount >= this.topology.retry.maxRetries) {
      channel.reject(message, false)
      return
    }

    await this.publishRetry({
      channel,
      message,
      retryCount: metadata.retryCount,
    })
  }

  private async publishRetry({ channel, message, retryCount }: PublishRetryParams): Promise<void> {
    try {
      await this.publishConfirmed({
        content: message.content,
        exchange: this.topology.retry.exchange,
        options: retryPublishOptions({ message, retryCount }),
        routingKey: this.topology.retry.routingKey,
      })
      channel.ack(message)
    } catch {
      channel.nack(message, false, true)
    }
  }

  private async publishConfirmed({ content, exchange, options, routingKey }: PublishConfirmedParams): Promise<void> {
    const confirmation = createDeferred<void>()
    const canWrite = this.publisherChannel.publish(exchange, routingKey, content, options, (error: unknown) => {
      if (error) {
        confirmation.reject(toError(error))
        return
      }

      confirmation.resolve()
    })

    if (canWrite) {
      await confirmation.promise
      return
    }

    await Promise.all([confirmation.promise, waitForDrain(this.publisherChannel)])
  }

  private cancelConsumer(consumerTag: string): Promise<void> {
    const consumer = this.consumers.get(consumerTag)

    if (!consumer) {
      return Promise.resolve()
    }

    consumer.cancellation ??= this.cancelAndDrain({
      consumer,
      consumerTag,
    })
    return consumer.cancellation
  }

  private async cancelAndDrain({ consumer, consumerTag }: CancelAndDrainParams): Promise<void> {
    await consumer.channel.cancel(consumerTag)
    await Promise.all([...consumer.inFlight])
    await consumer.channel.close()
    this.consumers.delete(consumerTag)
  }

  private async shutdown(): Promise<void> {
    this.closing = true
    await Promise.all([...this.consumers.keys()].map((consumerTag) => this.cancelConsumer(consumerTag)))
    await Promise.all([...this.openingConsumerChannels].map(closeChannel))
    await this.publisherChannel.waitForConfirms()
    await this.publisherChannel.close()
    await this.connection.close()
  }

  private assertOpen(): void {
    if (this.closing) {
      throw new RabbitMqProviderClosedError()
    }
  }
}

type ProcessDeliveryParams<TPayload> = {
  readonly channel: Channel
  readonly decode: RabbitMqConsumeParams<TPayload>['decode']
  readonly handler: RabbitMqConsumeParams<TPayload>['handler']
  readonly message: ConsumeMessage
}

type ApplyDispositionParams = {
  readonly channel: Channel
  readonly disposition: RabbitMqDisposition
  readonly message: ConsumeMessage
  readonly retryCount: number
}

type HandleFailureParams = {
  readonly channel: Channel
  readonly message: ConsumeMessage
  readonly metadata: RabbitMqConsumerMessage<unknown>
}

type PublishRetryParams = {
  readonly channel: Channel
  readonly message: ConsumeMessage
  readonly retryCount: number
}

type CancelAndDrainParams = {
  readonly consumer: ConsumerState
  readonly consumerTag: string
}

type PublishConfirmedParams = {
  readonly content: Buffer
  readonly exchange: string
  readonly options: Options.Publish
  readonly routingKey: string
}

type DecodeDeliveryParams<TPayload> = {
  readonly decode: RabbitMqConsumeParams<TPayload>['decode']
  readonly message: ConsumeMessage
  readonly retryQueue: string
}

function decodeDelivery<TPayload>({
  decode,
  message,
  retryQueue,
}: DecodeDeliveryParams<TPayload>): RabbitMqConsumerMessage<TPayload> | undefined {
  try {
    const headers = normalizeHeaders(message.properties.headers)
    return {
      payload: decode(JSON.parse(message.content.toString())),
      headers,
      messageId: stringProperty(message.properties.messageId),
      correlationId: stringProperty(message.properties.correlationId),
      redelivered: message.fields.redelivered,
      retryCount: retryCount({ headers, retryQueue }),
    }
  } catch {
    return undefined
  }
}

function normalizeHeaders(headers: MessagePropertyHeaders | undefined): Readonly<Record<string, unknown>> {
  return headers ?? {}
}

function stringProperty(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

type RetryCountParams = {
  readonly headers: Readonly<Record<string, unknown>>
  readonly retryQueue: string
}

function retryCount({ headers, retryQueue }: RetryCountParams): number {
  const providerRetryCount = headers['x-ada-retry-count']

  if (typeof providerRetryCount === 'number' && Number.isInteger(providerRetryCount) && providerRetryCount >= 0) {
    return providerRetryCount
  }

  const deaths = headers['x-death']

  if (!Array.isArray(deaths)) {
    return 0
  }

  return deaths.reduce<number>((count, death: unknown) => {
    if (!isRetryDeath(death, retryQueue)) {
      return count
    }

    return count + death.count
  }, 0)
}

function isRetryDeath(death: unknown, retryQueue: string): death is { readonly count: number; readonly queue: string } {
  if (!death || typeof death !== 'object') {
    return false
  }

  return 'count' in death && typeof death.count === 'number' && 'queue' in death && death.queue === retryQueue
}

type RetryPublishOptionsParams = {
  readonly message: ConsumeMessage
  readonly retryCount: number
}

function retryPublishOptions({ message, retryCount }: RetryPublishOptionsParams): Options.Publish {
  return {
    appId: stringProperty(message.properties.appId),
    contentEncoding: stringProperty(message.properties.contentEncoding),
    contentType: stringProperty(message.properties.contentType),
    correlationId: stringProperty(message.properties.correlationId),
    headers: {
      ...message.properties.headers,
      'x-ada-retry-count': retryCount + 1,
    },
    messageId: stringProperty(message.properties.messageId),
    persistent: true,
    type: stringProperty(message.properties.type),
  }
}

function createDeferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(reason?: unknown): void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function waitForDrain(channel: ConfirmChannel): Promise<void> {
  return new Promise((resolve) => {
    channel.once('drain', resolve)
  })
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('RabbitMQ publish failed')
}

function assertValidPrefetch(prefetch: number): void {
  if (!Number.isInteger(prefetch) || prefetch <= 0) {
    throw new RabbitMqConfigurationError('RabbitMQ consumer prefetch must be a positive integer')
  }
}

async function closeChannel(channel: Channel): Promise<void> {
  try {
    await channel.close()
  } catch {
    // Channel closure is best-effort while another lifecycle operation owns it.
  }
}
