/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
if (!process.env.RABBITMQ_TEST_URL) {
  throw new Error('RABBITMQ_TEST_URL is required for RabbitMQ integration tests')
}
