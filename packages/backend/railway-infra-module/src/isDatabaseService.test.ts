/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { isDatabaseService } from './isDatabaseService'
import type { RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'

function buildService(overrides: Partial<RailwayServiceInstance>): RailwayServiceInstance {
  return {
    serviceId: 'svc-1',
    serviceName: 'app',
    hasDeployment: true,
    isStopped: false,
    ...overrides,
  }
}

describe('isDatabaseService', () => {
  it('detects postgres-ssl from a registry path with tag', () => {
    const service = buildService({
      serviceName: 'Postgres',
      sourceImage: 'ghcr.io/railwayapp-templates/postgres-ssl:18',
    })
    expect(isDatabaseService(service)).toBe(true)
  })

  it('detects redis with a version tag', () => {
    expect(isDatabaseService(buildService({ serviceName: 'Redis', sourceImage: 'redis:8.2.9' }))).toBe(true)
  })

  it('detects a renamed service by its image', () => {
    expect(isDatabaseService(buildService({ serviceName: 'cache', sourceImage: 'redis:8' }))).toBe(true)
  })

  it('image wins over a database-looking name', () => {
    expect(isDatabaseService(buildService({ serviceName: 'Postgres-proxy', sourceImage: 'n8nio/n8n:latest' }))).toBe(
      false,
    )
  })

  it('does not flag tools whose image name only starts with a database name', () => {
    for (const sourceImage of [
      'rediscommander/redis-commander:latest',
      'redis-commander',
      'mongo-express:1',
      'postgrest/postgrest:v12',
    ]) {
      expect(isDatabaseService(buildService({ serviceName: 'tool', sourceImage }))).toBe(false)
    }
  })

  it('matches the known database image names exactly, case-insensitively', () => {
    for (const sourceImage of [
      'postgis/postgis:16',
      'mariadb:11',
      'MongoDB:7',
      'redis/redis-stack:latest',
      'mysql:8',
      'postgres@sha256:abc',
    ]) {
      expect(isDatabaseService(buildService({ serviceName: 'db', sourceImage }))).toBe(true)
    }
  })

  it('falls back to the name when there is no image', () => {
    expect(isDatabaseService(buildService({ serviceName: 'Redis' }))).toBe(true)
    expect(isDatabaseService(buildService({ serviceName: 'Redis', sourceImage: '' }))).toBe(true)
  })

  it('does not flag an application name without image', () => {
    expect(isDatabaseService(buildService({ serviceName: 'worker-uploads' }))).toBe(false)
  })
})
