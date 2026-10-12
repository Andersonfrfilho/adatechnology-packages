/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { calculateUsageCost } from './calculateUsageCost'
import { MINUTES_PER_MONTH, RAILWAY_PRICING } from '@adatechnology/railway-infra-contracts'

const NO_NAMES = new Map<string, string>()

// Valores que reproduzem ada-technology/staging do evidence.md T0.2 (CPU 0,05 · memoria 0,75 · disco 0,03 · rede 0).
const STAGING_ROWS = [
  { measurement: 'CPU_USAGE', value: 108, projectId: 'p1', environmentId: 'e1' },
  { measurement: 'MEMORY_USAGE_GB', value: 3240, projectId: 'p1', environmentId: 'e1' },
  { measurement: 'DISK_USAGE_GB', value: 8640, projectId: 'p1', environmentId: 'e1' },
  { measurement: 'NETWORK_TX_GB', value: 0, projectId: 'p1', environmentId: 'e1' },
]

describe('RAILWAY_PRICING', () => {
  it('usa o preco mensal dividido por 43 200 minutos', () => {
    expect(MINUTES_PER_MONTH).toBe(43_200)
    expect(RAILWAY_PRICING.CPU_USAGE.usdPerUnit * MINUTES_PER_MONTH).toBeCloseTo(20, 10)
    expect(RAILWAY_PRICING.MEMORY_USAGE_GB.usdPerUnit * MINUTES_PER_MONTH).toBeCloseTo(10, 10)
    expect(RAILWAY_PRICING.DISK_USAGE_GB.usdPerUnit * MINUTES_PER_MONTH).toBeCloseTo(0.15, 10)
    expect(RAILWAY_PRICING.NETWORK_TX_GB.usdPerUnit).toBe(0.05)
  })
})

describe('calculateUsageCost', () => {
  it('calcula custo por medida com os numeros reais de ada-technology/staging', () => {
    const result = calculateUsageCost({
      rows: STAGING_ROWS,
      projectNames: new Map([['p1', 'ada-technology']]),
      environmentNames: new Map([['e1', 'staging']]),
    })

    const project = result.projects[0]
    const environment = project?.environments[0]
    expect(project?.projectName).toBe('ada-technology')
    expect(environment?.environmentName).toBe('staging')
    expect(environment?.isProduction).toBe(false)
    expect(environment?.byMeasurement.CPU_USAGE).toBeCloseTo(0.05, 10)
    expect(environment?.byMeasurement.MEMORY_USAGE_GB).toBeCloseTo(0.75, 10)
    expect(environment?.byMeasurement.DISK_USAGE_GB).toBeCloseTo(0.03, 10)
    expect(environment?.byMeasurement.NETWORK_TX_GB).toBe(0)
    expect(environment?.cost).toBeCloseTo(0.83, 10)
    expect(result.totalCost).toBeCloseTo(0.83, 10)
  })

  it('soma ambientes e projetos e marca producao pela mesma regra do classifyEnvironment', () => {
    const result = calculateUsageCost({
      rows: [
        { measurement: 'NETWORK_TX_GB', value: 10, projectId: 'p1', environmentId: 'e1' },
        { measurement: 'NETWORK_TX_GB', value: 20, projectId: 'p1', environmentId: 'e2' },
        { measurement: 'NETWORK_TX_GB', value: 40, projectId: 'p2', environmentId: 'e3' },
      ],
      projectNames: NO_NAMES,
      environmentNames: new Map([
        ['e1', 'Production'],
        ['e2', 'staging'],
        ['e3', 'cbni-production'],
      ]),
    })

    expect(result.projects.map((project) => project.cost)).toEqual([1.5, 2])
    expect(result.totalCost).toBeCloseTo(3.5, 10)
    expect(result.projects[0]?.environments.map((environment) => environment.isProduction)).toEqual([true, false])
    expect(result.projects[1]?.environments[0]?.isProduction).toBe(true)
  })

  it('lista vazia devolve zero', () => {
    expect(calculateUsageCost({ rows: [], projectNames: NO_NAMES, environmentNames: NO_NAMES })).toEqual({
      totalCost: 0,
      projects: [],
    })
  })

  it('ignora medida desconhecida', () => {
    const result = calculateUsageCost({
      rows: [
        { measurement: 'BACKUP_USAGE_GB', value: 999, projectId: 'p1', environmentId: 'e1' },
        { measurement: 'NETWORK_TX_GB', value: 2, projectId: 'p1', environmentId: 'e1' },
      ],
      projectNames: NO_NAMES,
      environmentNames: NO_NAMES,
    })

    expect(result.totalCost).toBeCloseTo(0.1, 10)
  })

  it('ambiente e projeto sem nome entram com o id', () => {
    const result = calculateUsageCost({
      rows: [{ measurement: 'NETWORK_TX_GB', value: 1, projectId: 'p-x', environmentId: 'e-x' }],
      projectNames: NO_NAMES,
      environmentNames: NO_NAMES,
    })

    expect(result.projects[0]?.projectName).toBe('p-x')
    expect(result.projects[0]?.environments[0]?.environmentName).toBe('e-x')
  })
})
