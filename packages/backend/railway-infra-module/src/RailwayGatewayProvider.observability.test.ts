/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildProviderHarness, buildRecord, DECOY_TOKEN } from './testing/buildProviderHarness'

describe('DefaultRailwayGatewayProvider: panel row check failure', () => {
  it('logs a structured warning without the error text and keeps reporting no panel row', async () => {
    const harness = buildProviderHarness({ config: { environmentToken: 'ISCA-AMBIENTE-0123456789' } })
    harness.repository.seed(buildRecord())
    harness.repository.failWith = new Error(`insert ... ciphertext=${DECOY_TOKEN}`)

    const description = await harness.provider.describe()

    expect(description.environmentTokenAlsoPresent).toBe(false)
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain('infra.integration.panel_row_check_failed')
    expect(harness.warnings[0]).not.toContain(DECOY_TOKEN)
  })
})
