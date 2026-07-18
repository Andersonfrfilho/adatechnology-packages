/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
if (process.env.DRIZZLE_TEST_DATABASE_URL === undefined && process.env.DATABASE_URL === undefined) {
  throw new Error('DRIZZLE_TEST_DATABASE_URL or DATABASE_URL is required for integration tests')
}
