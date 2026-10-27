/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

function buildService(overrides: Partial<InfraServiceInstance>): InfraServiceInstance {
  return {
    serviceId: 'svc-1',
    serviceName: 'app',
    hasDeployment: true,
    isStopped: false,
    instanceStatus: 'RUNNING',
    ...overrides,
  }
}

function buildServiceWithoutInstanceStatus(overrides: Partial<InfraServiceInstance>): InfraServiceInstance {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { instanceStatus: _omitted, ...service } = buildService(overrides)
  return service
}

describe('resolveServicePowerState', () => {
  it('returns no_deployment when there is no deployment', () => {
    expect(resolveServicePowerState(buildServiceWithoutInstanceStatus({ hasDeployment: false }))).toBe('no_deployment')
  })

  it('returns stopped when the deployment is stopped', () => {
    expect(resolveServicePowerState(buildService({ isStopped: true, instanceStatus: 'EXITED' }))).toBe('stopped')
  })

  it('does not treat a SUCCESS deployment with deploymentStopped as running', () => {
    expect(resolveServicePowerState(buildService({ isStopped: true, instanceStatus: 'RUNNING' }))).toBe('stopped')
  })

  it('returns running when not stopped and instance is RUNNING', () => {
    expect(resolveServicePowerState(buildService({}))).toBe('running')
  })

  it('returns transitioning for INITIALIZING', () => {
    expect(resolveServicePowerState(buildService({ instanceStatus: 'INITIALIZING' }))).toBe('transitioning')
  })

  it('returns transitioning for EXITED without isStopped', () => {
    expect(resolveServicePowerState(buildService({ instanceStatus: 'EXITED' }))).toBe('transitioning')
  })

  it('returns transitioning when instanceStatus is missing', () => {
    expect(resolveServicePowerState(buildServiceWithoutInstanceStatus({}))).toBe('transitioning')
  })
})
