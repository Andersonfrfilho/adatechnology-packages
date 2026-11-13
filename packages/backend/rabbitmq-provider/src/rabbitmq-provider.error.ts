/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export class RabbitMqProviderClosedError extends Error {
  readonly name = 'RabbitMqProviderClosedError'

  constructor() {
    super('RabbitMQ provider is closing or already closed')
  }
}

export class RabbitMqConfigurationError extends Error {
  readonly name = 'RabbitMqConfigurationError'

  constructor(message: string) {
    super(message)
  }
}
