/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { orderServicesForPower } from './orderServicesForPower'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

function buildService(serviceName: string, sourceImage?: string): InfraServiceInstance {
  return {
    serviceId: `id-${serviceName}`,
    serviceName,
    ...(sourceImage === undefined ? {} : { sourceImage }),
    hasDeployment: true,
    isStopped: false,
  }
}

const INVENTORY: readonly InfraServiceInstance[] = [
  buildService('financing-backend'),
  buildService('Postgres', 'ghcr.io/railwayapp-templates/postgres-ssl:18'),
  buildService('financing-frontend'),
  buildService('worker-uploads'),
  buildService('Redis', 'redis:8.2.9'),
  buildService('n8n', 'n8nio/n8n:latest'),
]

function names(services: readonly InfraServiceInstance[]): string[] {
  return services.map((service) => service.serviceName)
}

describe('orderServicesForPower', () => {
  it('puts applications first and databases last when turning off', () => {
    const { ordered } = orderServicesForPower({ services: INVENTORY, direction: 'off' })
    expect(names(ordered)).toEqual([
      'financing-backend',
      'financing-frontend',
      'worker-uploads',
      'n8n',
      'Postgres',
      'Redis',
    ])
  })

  it('puts databases first and applications last when turning on', () => {
    const { ordered } = orderServicesForPower({ services: INVENTORY, direction: 'on' })
    expect(names(ordered)).toEqual([
      'Postgres',
      'Redis',
      'financing-backend',
      'financing-frontend',
      'worker-uploads',
      'n8n',
    ])
  })

  it('returns an empty list for empty input', () => {
    expect(orderServicesForPower({ services: [], direction: 'off' }).ordered).toEqual([])
  })

  it('keeps order when there are only databases', () => {
    const services = [buildService('Postgres', 'postgres:16'), buildService('Redis', 'redis:8')]
    expect(names(orderServicesForPower({ services, direction: 'off' }).ordered)).toEqual(['Postgres', 'Redis'])
    expect(names(orderServicesForPower({ services, direction: 'on' }).ordered)).toEqual(['Postgres', 'Redis'])
  })

  it('does not mutate the input array', () => {
    const input = [...INVENTORY]
    const snapshot = names(input)
    orderServicesForPower({ services: input, direction: 'off' })
    expect(names(input)).toEqual(snapshot)
  })
})
