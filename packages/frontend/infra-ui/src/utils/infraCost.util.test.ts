/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  buildChartSegments,
  computeShare,
  computeStagingShare,
  sortProjectsByCost,
  sumMeasurementCost,
} from './costChart.util'
import { formatCycleRange, formatPercent, formatUsd, resolveSafeUrl } from './costFormat.util'
import type { InfraEnvironmentCost, InfraProjectCost } from '../types/infra.types'

function buildEnvironment({
  name,
  cost,
  isProduction,
}: {
  name: string
  cost: number
  isProduction: boolean
}): InfraEnvironmentCost {
  return { environmentId: name, environmentName: name, isProduction, cost, byMeasurement: {} }
}

function buildProject({
  name,
  environments,
}: {
  name: string
  environments: InfraEnvironmentCost[]
}): InfraProjectCost {
  const cost = environments.reduce((sum, environment) => sum + environment.cost, 0)

  return { projectId: name, projectName: name, cost, projected: cost * 2, environments }
}

const SMALL = buildProject({
  name: 'small',
  environments: [
    buildEnvironment({ name: 'staging', cost: 1, isProduction: false }),
    buildEnvironment({ name: 'production', cost: 3, isProduction: true }),
  ],
})
const LARGE = buildProject({
  name: 'large',
  environments: [
    buildEnvironment({ name: 'staging', cost: 6, isProduction: false }),
    buildEnvironment({ name: 'production', cost: 10, isProduction: true }),
  ],
})

describe('formatUsd', () => {
  it('formats in pt-BR with the dollar currency', () => {
    expect(formatUsd(1234.5).replace(/\s/g, ' ')).toBe('US$ 1.234,50')
  })

  it('formats zero', () => {
    expect(formatUsd(0).replace(/\s/g, ' ')).toBe('US$ 0,00')
  })
})

describe('formatPercent', () => {
  it('formats a ratio with up to one decimal', () => {
    expect(formatPercent(0.375)).toBe('37,5%')
    expect(formatPercent(0.5)).toBe('50%')
  })
})

describe('formatCycleRange', () => {
  it('shows the cycle days as stored, without shifting to the previous day', () => {
    const text = formatCycleRange({ periodStart: '2026-09-19T00:00:00Z', periodEnd: '2026-10-19T00:00:00Z' })

    expect(text).toContain('19')
    expect(text).toContain('2026')
    expect(text).not.toContain('18')
  })
})

describe('computeStagingShare', () => {
  it('divides non-production cost by the total', () => {
    expect(computeStagingShare({ projects: [SMALL, LARGE] })).toBe(7 / 20)
  })

  it('is undefined when there is no cost', () => {
    const empty = buildProject({
      name: 'empty',
      environments: [buildEnvironment({ name: 'staging', cost: 0, isProduction: false })],
    })

    expect(computeStagingShare({ projects: [empty] })).toBeUndefined()
    expect(computeStagingShare({ projects: [] })).toBeUndefined()
  })
})

describe('buildChartSegments', () => {
  it('orders projects by total cost, largest first', () => {
    expect(buildChartSegments({ projects: [SMALL, LARGE] }).map((row) => row.projectName)).toEqual(['large', 'small'])
    expect(sortProjectsByCost([SMALL, LARGE])[0]?.projectName).toBe('large')
  })

  it('computes proportions inside each bar and relative length across bars', () => {
    const [large, small] = buildChartSegments({ projects: [SMALL, LARGE] })

    expect(large).toMatchObject({ stagingCost: 6, productionCost: 10, totalCost: 16, lengthRatio: 1 })
    expect(large?.stagingRatio).toBe(6 / 16)
    expect(large?.productionRatio).toBe(10 / 16)
    expect(small?.lengthRatio).toBe(4 / 16)
  })

  it('treats a total of zero as zero-length bars, never NaN', () => {
    const empty = buildProject({
      name: 'empty',
      environments: [buildEnvironment({ name: 'staging', cost: 0, isProduction: false })],
    })
    const [row] = buildChartSegments({ projects: [empty] })

    expect(row).toMatchObject({ totalCost: 0, stagingRatio: 0, productionRatio: 0, lengthRatio: 0 })
  })

  it('returns an empty list for no projects', () => {
    expect(buildChartSegments({ projects: [] })).toEqual([])
  })
})

describe('computeShare / sumMeasurementCost', () => {
  it('computes a share and guards against a zero total', () => {
    expect(computeShare({ cost: 1, total: 4 })).toBe(0.25)
    expect(computeShare({ cost: 1, total: 0 })).toBe(0)
  })

  it('sums one measurement across environments, ignoring missing ones', () => {
    const environments = [
      { ...buildEnvironment({ name: 'a', cost: 1, isProduction: false }), byMeasurement: { CPU_USAGE: 1.5 } },
      {
        ...buildEnvironment({ name: 'b', cost: 1, isProduction: true }),
        byMeasurement: { CPU_USAGE: 2, DISK_USAGE_GB: 1 },
      },
      buildEnvironment({ name: 'c', cost: 1, isProduction: true }),
    ]

    expect(sumMeasurementCost({ environments, measurement: 'CPU_USAGE' })).toBe(3.5)
    expect(sumMeasurementCost({ environments, measurement: 'NETWORK_TX_GB' })).toBe(0)
  })
})

describe('resolveSafeUrl', () => {
  it('accepts http and https only', () => {
    expect(resolveSafeUrl('https://docs.railway.com/reference/pricing')).toBe(
      'https://docs.railway.com/reference/pricing',
    )
    expect(resolveSafeUrl('javascript:alert(1)')).toBeUndefined()
    expect(resolveSafeUrl('not a url')).toBeUndefined()
  })
})
