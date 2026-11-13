/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { countServiceOutcomes, resolveOperationStatus } from './resolveOperationStatus'
import type { InfraServiceResult } from '@adatechnology/infra-contracts'

function results(...outcomes: InfraServiceResult['outcome'][]): InfraServiceResult[] {
  return outcomes.map((outcome, index) => ({ serviceName: `svc-${index}`, outcome }))
}

describe('resolveOperationStatus', () => {
  it('is succeeded when everything is ok or skipped (including no services)', () => {
    expect(resolveOperationStatus({ serviceResults: results('ok', 'skipped') })).toBe('succeeded')
    expect(resolveOperationStatus({ serviceResults: results('skipped') })).toBe('succeeded')
    expect(resolveOperationStatus({ serviceResults: [] })).toBe('succeeded')
  })

  it('is partially_failed when some failed and some are ok', () => {
    expect(resolveOperationStatus({ serviceResults: results('ok', 'failed', 'skipped') })).toBe('partially_failed')
  })

  it('is failed when every non-skipped service failed', () => {
    expect(resolveOperationStatus({ serviceResults: results('failed', 'failed') })).toBe('failed')
    expect(resolveOperationStatus({ serviceResults: results('failed', 'skipped') })).toBe('failed')
  })

  it('counts outcomes', () => {
    expect(countServiceOutcomes(results('ok', 'ok', 'failed', 'skipped'))).toEqual({ ok: 2, failed: 1, skipped: 1 })
  })
})
