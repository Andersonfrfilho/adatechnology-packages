/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { connect, type ConfirmChannel } from 'amqplib'

import { RabbitMqConfigurationError } from './rabbitmq-provider.error'
import { RabbitMqProviderService } from './rabbitmq-provider.service'
import type { RabbitMqProvider, RabbitMqProviderConfig, RabbitMqTopology } from './rabbitmq-provider.types'

export async function createRabbitMqProvider(config: RabbitMqProviderConfig): Promise<RabbitMqProvider> {
  assertValidTopology(config.topology)
  const connection = await connect(config.connection)
  const publisherChannel = await connection.createConfirmChannel()

  try {
    await assertTopology({
      channel: publisherChannel,
      topology: config.topology,
    })
  } catch (error: unknown) {
    await publisherChannel.close()
    await connection.close()
    throw error
  }

  return new RabbitMqProviderService({
    connection,
    publisherChannel,
    topology: config.topology,
  })
}

type AssertTopologyParams = {
  readonly channel: ConfirmChannel
  readonly topology: RabbitMqTopology
}

async function assertTopology({ channel, topology }: AssertTopologyParams): Promise<void> {
  await channel.assertExchange(topology.exchange, 'direct', {
    durable: true,
  })
  await channel.assertExchange(topology.retry.exchange, 'direct', {
    durable: true,
  })
  await channel.assertExchange(topology.deadLetter.exchange, 'direct', {
    durable: true,
  })

  await channel.assertQueue(topology.queue, {
    durable: true,
    deadLetterExchange: topology.deadLetter.exchange,
    deadLetterRoutingKey: topology.deadLetter.routingKey,
  })
  await channel.bindQueue(topology.queue, topology.exchange, topology.routingKey)

  await channel.assertQueue(topology.retry.queue, {
    durable: true,
    messageTtl: topology.retry.delayMs,
    deadLetterExchange: topology.exchange,
    deadLetterRoutingKey: topology.routingKey,
  })
  await channel.bindQueue(topology.retry.queue, topology.retry.exchange, topology.retry.routingKey)

  await channel.assertQueue(topology.deadLetter.queue, {
    durable: true,
  })
  await channel.bindQueue(topology.deadLetter.queue, topology.deadLetter.exchange, topology.deadLetter.routingKey)
}

function assertValidTopology(topology: RabbitMqTopology): void {
  if (!Number.isInteger(topology.retry.delayMs) || topology.retry.delayMs <= 0) {
    throw new RabbitMqConfigurationError('RabbitMQ retry delayMs must be a positive integer')
  }

  if (!Number.isInteger(topology.retry.maxRetries) || topology.retry.maxRetries < 0) {
    throw new RabbitMqConfigurationError('RabbitMQ retry maxRetries must be a non-negative integer')
  }
}
