/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { canPowerOff, canPowerOn, listServicesToStop, matchesEnvironmentName } from './environmentAction.util'

describe('canPowerOff / canPowerOn', () => {
  it('allows both on a managed environment with something running and something stopped', () => {
    const environment = { classification: 'managed', state: 'partial' } as const

    expect(canPowerOff(environment)).toBe(true)
    expect(canPowerOn(environment)).toBe(true)
  })

  it('allows only power off when everything is running', () => {
    const environment = { classification: 'managed', state: 'running' } as const

    expect(canPowerOff(environment)).toBe(true)
    expect(canPowerOn(environment)).toBe(false)
  })

  it('allows only power on when everything is stopped', () => {
    const environment = { classification: 'managed', state: 'stopped' } as const

    expect(canPowerOff(environment)).toBe(false)
    expect(canPowerOn(environment)).toBe(true)
  })

  it('never allows protected or unmanaged environments', () => {
    for (const classification of ['protected', 'unmanaged'] as const) {
      expect(canPowerOff({ classification, state: 'running' })).toBe(false)
      expect(canPowerOn({ classification, state: 'stopped' })).toBe(false)
    }
  })

  it('blocks both while an operation is running or the state is transitioning', () => {
    expect(canPowerOff({ classification: 'managed', state: 'running', runningOperationId: 'op' })).toBe(false)
    expect(canPowerOn({ classification: 'managed', state: 'stopped', runningOperationId: 'op' })).toBe(false)
    expect(canPowerOff({ classification: 'managed', state: 'transitioning' })).toBe(false)
    expect(canPowerOn({ classification: 'managed', state: 'transitioning' })).toBe(false)
  })
})

describe('matchesEnvironmentName', () => {
  it('matches only the exact, case-sensitive name', () => {
    expect(matchesEnvironmentName({ typed: 'cbni-staging', expected: 'cbni-staging' })).toBe(true)
    expect(matchesEnvironmentName({ typed: 'CBNI-staging', expected: 'cbni-staging' })).toBe(false)
    expect(matchesEnvironmentName({ typed: 'cbni-staging ', expected: 'cbni-staging' })).toBe(false)
    expect(matchesEnvironmentName({ typed: 'cbni', expected: 'cbni-staging' })).toBe(false)
  })

  it('never matches an empty expected name', () => {
    expect(matchesEnvironmentName({ typed: '', expected: '' })).toBe(false)
  })
})

describe('listServicesToStop', () => {
  it('lists only live services, applications first and databases last', () => {
    const services = [
      { serviceName: 'postgres', isDatabase: true, powerState: 'running' },
      { serviceName: 'api', isDatabase: false, powerState: 'running' },
      { serviceName: 'old', isDatabase: false, powerState: 'stopped' },
      { serviceName: 'draft', isDatabase: false, powerState: 'no_deployment' },
      { serviceName: 'worker', isDatabase: false, powerState: 'transitioning' },
    ] as const

    expect(listServicesToStop(services).map((service) => service.serviceName)).toEqual(['api', 'worker', 'postgres'])
  })
})
