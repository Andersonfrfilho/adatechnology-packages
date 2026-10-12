/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildProviderHarness, buildRecord, REREAD_MILLISECONDS } from './testing/buildProviderHarness'

const LATER = new Date('2026-10-09T13:00:00Z')

describe('DefaultRailwayGatewayProvider cache and generation', () => {
  it('rereads at most once per interval', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    await harness.provider.resolve()
    harness.clock.now += REREAD_MILLISECONDS - 1
    await harness.provider.resolve()
    expect(harness.repository.reads).toBe(1)
    harness.clock.now += 1
    await harness.provider.resolve()
    expect(harness.repository.reads).toBe(2)
  })

  it('keeps the same gateway object while the fingerprint is unchanged (preserves Retry-After)', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    harness.clock.now += REREAD_MILLISECONDS
    const second = await harness.provider.resolve()
    expect(harness.repository.reads).toBe(2)
    expect(second).toBe(first)
    expect(harness.builtWith).toHaveLength(1)
  })

  it('builds a new gateway when the credential changes', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    harness.repository.seed(buildRecord({ updatedAt: LATER }))
    harness.clock.now += REREAD_MILLISECONDS
    const second = await harness.provider.resolve()
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
    expect(harness.builtWith).toHaveLength(2)
  })

  it('invalidate makes the next call reread', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    await harness.provider.resolve()
    harness.provider.invalidate()
    await harness.provider.resolve()
    expect(harness.repository.reads).toBe(2)
  })

  it('drops the gateway when the row is removed and invalidated', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    expect(await harness.provider.resolve()).toBeDefined()
    harness.repository.records.clear()
    harness.provider.invalidate()
    expect(await harness.provider.resolve()).toBeUndefined()
  })

  it('shares one read between simultaneous resolutions', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => harness.provider.resolve()))
    expect(harness.repository.reads).toBe(1)
    expect(new Set(results).size).toBe(1)
  })

  it('a slow resolution started before invalidate does not repopulate the cache with the old value', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    let releaseSlowRead: () => void = () => undefined
    harness.repository.gates.push(new Promise<void>((resolve) => (releaseSlowRead = resolve)))
    const slow = harness.provider.resolve()
    harness.provider.invalidate()
    harness.repository.seed(buildRecord({ updatedAt: LATER }))
    const fresh = await harness.provider.resolve()
    releaseSlowRead()
    const stale = await slow
    expect(stale).not.toBe(fresh)
    expect(await harness.provider.resolve()).toBe(fresh)
    expect(harness.repository.reads).toBe(2)
  })

  it('a slow resolution invalidated midway leaves the cache empty so the next call rereads', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    let releaseSlowRead: () => void = () => undefined
    harness.repository.gates.push(new Promise<void>((resolve) => (releaseSlowRead = resolve)))
    const slow = harness.provider.resolve()
    harness.provider.invalidate()
    releaseSlowRead()
    await slow
    await harness.provider.resolve()
    expect(harness.repository.reads).toBe(2)
  })

  it('a store outage does not forget the last gateway, so a rate-limit block survives the blip', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    harness.clock.now += REREAD_MILLISECONDS
    harness.repository.failWith = new Error('database down')
    expect(await harness.provider.resolve()).toBeUndefined()
    harness.repository.failWith = undefined
    const recovered = await harness.provider.resolve()
    expect(recovered).toBe(first)
    expect(harness.builtWith).toHaveLength(1)
  })

  it('a row that disappeared is forgotten, so a recreated identical row builds a fresh gateway', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    harness.repository.records.clear()
    harness.provider.invalidate()
    expect(await harness.provider.resolve()).toBeUndefined()
    harness.repository.seed(buildRecord())
    harness.provider.invalidate()
    expect(await harness.provider.resolve()).not.toBe(first)
  })

  it('isCurrent: the resolved gateway is current until invalidate, the next one replaces it', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    if (!first) throw new Error('gateway esperado')
    expect(harness.provider.isCurrent(first)).toBe(true)

    harness.provider.invalidate()
    expect(harness.provider.isCurrent(first)).toBe(false)

    harness.repository.seed(buildRecord({ updatedAt: LATER }))
    const second = await harness.provider.resolve()
    if (!second) throw new Error('gateway esperado')
    expect(harness.provider.isCurrent(second)).toBe(true)
    expect(harness.provider.isCurrent(first)).toBe(false)
  })

  it('isCurrent: stays true after the reread interval while the credential is unchanged', async () => {
    const harness = buildProviderHarness()
    harness.repository.seed(buildRecord())
    const first = await harness.provider.resolve()
    if (!first) throw new Error('gateway esperado')
    harness.clock.now += REREAD_MILLISECONDS * 3
    expect(harness.provider.isCurrent(first)).toBe(true)
  })
})
