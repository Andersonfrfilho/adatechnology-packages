/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { connect, type Channel, type ChannelModel } from 'amqplib'

import {
  createRabbitMqProvider,
  RabbitMqConfigurationError,
  type RabbitMqConsumerMessage,
  type RabbitMqProvider,
  type RabbitMqTopology,
} from './index'

const rabbitMqUrl = process.env.RABBITMQ_TEST_URL
const describeWithBroker = rabbitMqUrl ? describe : describe.skip
const suiteId = `ada.rabbitmq.${crypto.randomUUID()}`

const topology: RabbitMqTopology = {
  exchange: `${suiteId}.exchange`,
  queue: `${suiteId}.queue`,
  routingKey: `${suiteId}.route`,
  retry: {
    delayMs: 80,
    exchange: `${suiteId}.retry.exchange`,
    maxRetries: 3,
    queue: `${suiteId}.retry.queue`,
    routingKey: `${suiteId}.retry.route`,
  },
  deadLetter: {
    exchange: `${suiteId}.dead.exchange`,
    queue: `${suiteId}.dead.queue`,
    routingKey: `${suiteId}.dead.route`,
  },
}

type TestMessage = {
  readonly id: string
}

describeWithBroker('RabbitMqProvider integration', () => {
  let provider: RabbitMqProvider
  let probeConnection: ChannelModel
  let probeChannel: Channel

  beforeAll(async () => {
    provider = await createRabbitMqProvider({
      connection: rabbitMqUrl!,
      topology,
    })
    probeConnection = await connect(rabbitMqUrl!)
    probeChannel = await probeConnection.createChannel()
  })

  afterAll(async () => {
    await provider.close()
    await deleteTopology(probeChannel, topology)
    await probeChannel.close()
    await probeConnection.close()
  })

  test('checks broker health and publishes persistent messages', async () => {
    await expect(provider.healthCheck()).resolves.toEqual({ healthy: true })

    await provider.publish<TestMessage>({
      id: 'persistent-message',
    })

    const delivery = await probeChannel.get(topology.queue, { noAck: false })
    expect(delivery).not.toBe(false)

    if (delivery) {
      expect(delivery.properties.deliveryMode).toBe(2)
      probeChannel.ack(delivery)
    }
  })

  test('uses manual acknowledgement and honors prefetch', async () => {
    const firstStarted = createDeferred<void>()
    const releaseFirst = createDeferred<void>()
    const received: string[] = []

    const consumer = await provider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: async ({ payload }) => {
        received.push(payload.id)

        if (payload.id === 'prefetch-first') {
          firstStarted.resolve()
          await releaseFirst.promise
        }

        return { type: 'ack' }
      },
    })

    await provider.publish({ id: 'prefetch-first' })
    await provider.publish({ id: 'prefetch-second' })
    await firstStarted.promise
    await Bun.sleep(100)

    expect(received).toEqual(['prefetch-first'])

    releaseFirst.resolve()
    await waitFor(() => received.length === 2)
    expect(received).toEqual(['prefetch-first', 'prefetch-second'])

    await consumer.cancel()
  })

  test('requeues handler failures and retries through TTL and DLX', async () => {
    const deliveries: RabbitMqConsumerMessage<TestMessage>[] = []
    const completed = createDeferred<void>()

    const consumer = await provider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: async (message) => {
        deliveries.push(message)

        if (deliveries.length === 1) {
          throw new Error('transient test failure')
        }

        if (deliveries.length === 2) {
          return { type: 'retry' }
        }

        completed.resolve()
        return { type: 'ack' }
      },
    })

    await provider.publish({ id: 'retry-message' })
    await completed.promise

    expect(deliveries).toHaveLength(3)
    expect(deliveries[1]?.redelivered).toBe(true)
    expect(deliveries[2]?.retryCount).toBeGreaterThanOrEqual(1)
    expect(deliveries[2]?.headers['x-death']).toBeArray()

    await consumer.cancel()
  })

  test('dead-letters after the configured retry limit', async () => {
    const retryCounts: number[] = []
    const consumer = await provider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: (message) => {
        retryCounts.push(message.retryCount)
        return { type: 'retry' }
      },
    })

    await provider.publish({ id: 'retry-limit-message' })

    const deadLetter = await waitForMessage(probeChannel, topology.deadLetter.queue)
    expect(retryCounts).toEqual([0, 1, 2, 3])
    expect(JSON.parse(deadLetter.content.toString())).toEqual({
      id: 'retry-limit-message',
    })
    probeChannel.ack(deadLetter)

    await consumer.cancel()
  })

  test('limits repeated handler failures and preserves broker redelivery', async () => {
    const deliveries: RabbitMqConsumerMessage<TestMessage>[] = []
    const consumer = await provider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: (message) => {
        deliveries.push(message)
        throw new Error('persistent test failure')
      },
    })

    await provider.publish({ id: 'handler-failure-limit-message' })

    const deadLetter = await waitForMessage(probeChannel, topology.deadLetter.queue)
    expect(deliveries).toHaveLength(5)
    expect(deliveries[1]?.redelivered).toBe(true)
    expect(deliveries.map(({ retryCount }) => retryCount)).toEqual([0, 0, 1, 2, 3])
    expect(JSON.parse(deadLetter.content.toString())).toEqual({
      id: 'handler-failure-limit-message',
    })
    probeChannel.ack(deadLetter)

    await consumer.cancel()
  })

  test('dead-letters an explicit handler disposition', async () => {
    const handled = createDeferred<void>()
    const consumer = await provider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: (message) => {
        if (message.payload.id === 'dead-letter-message') {
          handled.resolve()
        }

        return { type: 'dead-letter' }
      },
    })

    await provider.publish({ id: 'dead-letter-message' })
    await handled.promise

    const deadLetter = await waitForMessage(probeChannel, topology.deadLetter.queue)
    expect(deadLetter.properties.headers?.['x-death']).toBeArray()
    expect(JSON.parse(deadLetter.content.toString())).toEqual({
      id: 'dead-letter-message',
    })
    probeChannel.ack(deadLetter)

    await consumer.cancel()
  })

  test('cancels consumers, drains handlers and closes idempotently', async () => {
    const shutdownTopology = createTopology(`${suiteId}.shutdown`)
    const shutdownProvider = await createRabbitMqProvider({
      connection: rabbitMqUrl!,
      topology: shutdownTopology,
    })
    const handlerStarted = createDeferred<void>()
    const releaseHandler = createDeferred<void>()

    await shutdownProvider.consume<TestMessage>({
      decode: decodeTestMessage,
      prefetch: 1,
      handler: async () => {
        handlerStarted.resolve()
        await releaseHandler.promise
        return { type: 'ack' }
      },
    })

    await shutdownProvider.publish({ id: 'shutdown-message' })
    await handlerStarted.promise

    let closed = false
    const closePromise = shutdownProvider.close().then(() => {
      closed = true
    })

    await Bun.sleep(100)
    expect(closed).toBe(false)

    releaseHandler.resolve()
    await closePromise
    await expect(shutdownProvider.close()).resolves.toBeUndefined()
    await deleteTopology(probeChannel, shutdownTopology)
  })

  test('rejects invalid prefetch and retry delay configuration', async () => {
    await expect(
      provider.consume({
        decode: decodeTestMessage,
        prefetch: 0,
        handler: () => ({ type: 'ack' }),
      }),
    ).rejects.toBeInstanceOf(RabbitMqConfigurationError)

    const validTopology = createTopology(`${suiteId}.invalid`)
    const invalidTopology: RabbitMqTopology = {
      ...validTopology,
      retry: {
        ...validTopology.retry,
        delayMs: 0,
      },
    }

    await expect(
      createRabbitMqProvider({
        connection: rabbitMqUrl!,
        topology: invalidTopology,
      }),
    ).rejects.toBeInstanceOf(RabbitMqConfigurationError)
  })
})

function createTopology(prefix: string): RabbitMqTopology {
  return {
    exchange: `${prefix}.exchange`,
    queue: `${prefix}.queue`,
    routingKey: `${prefix}.route`,
    retry: {
      delayMs: 80,
      exchange: `${prefix}.retry.exchange`,
      maxRetries: 3,
      queue: `${prefix}.retry.queue`,
      routingKey: `${prefix}.retry.route`,
    },
    deadLetter: {
      exchange: `${prefix}.dead.exchange`,
      queue: `${prefix}.dead.queue`,
      routingKey: `${prefix}.dead.route`,
    },
  }
}

function decodeTestMessage(value: unknown): TestMessage {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') {
    throw new Error('Invalid test message')
  }

  return { id: value.id }
}

async function deleteTopology(channel: Channel, target: RabbitMqTopology): Promise<void> {
  await channel.deleteQueue(target.queue)
  await channel.deleteQueue(target.retry.queue)
  await channel.deleteQueue(target.deadLetter.queue)
  await channel.deleteExchange(target.exchange)
  await channel.deleteExchange(target.retry.exchange)
  await channel.deleteExchange(target.deadLetter.exchange)
}

function createDeferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for RabbitMQ condition')
    }

    await Bun.sleep(10)
  }
}

async function waitForMessage(
  channel: Channel,
  queue: string,
): Promise<Exclude<Awaited<ReturnType<Channel['get']>>, false>> {
  let message = await channel.get(queue, { noAck: false })
  const deadline = Date.now() + 5_000

  while (!message) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for message in ${queue}`)
    }

    await Bun.sleep(10)
    message = await channel.get(queue, { noAck: false })
  }

  return message
}
