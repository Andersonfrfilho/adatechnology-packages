/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InfraProviderRateLimitedError } from '@adatechnology/infra-contracts'
import { RailwayGateway } from './RailwayGateway'

const START_MILLISECONDS = Date.parse('2026-10-09T12:00:00.000Z')
const BILLING_BODY = {
  workspace: { customer: { currentUsage: 1, billingPeriod: { start: 'a', end: 'b' } } },
}

type Harness = {
  readonly gateway: RailwayGateway
  readonly clock: { current: number }
  readonly fetchCount: () => number
}

function buildHarness(rateLimitHeaders: Record<string, string> | undefined): Harness {
  let calls = 0
  let isLimited = rateLimitHeaders !== undefined
  const clock = { current: START_MILLISECONDS }
  const fetchImplementation = (async () => {
    calls += 1
    if (isLimited) {
      isLimited = false
      return new Response('{}', { status: 429, headers: rateLimitHeaders ?? {} })
    }
    return new Response(JSON.stringify({ data: BILLING_BODY }), { status: 200 })
  }) as unknown as typeof fetch
  const gateway = new RailwayGateway({
    token: 't',
    workspaceId: 'w',
    fetchImplementation,
    now: () => clock.current,
  })
  return { gateway, clock, fetchCount: () => calls }
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action()
  } catch (error) {
    return error
  }
  return undefined
}

describe('RailwayGateway rate limit', () => {
  it('429 com Retry-After bloqueia as chamadas seguintes sem fetch ate o relogio avancar', async () => {
    const { gateway, clock, fetchCount } = buildHarness({ 'Retry-After': '10' })

    await captureError(() => gateway.getBillingCycle())
    const blocked = await captureError(() => gateway.getBillingCycle())

    expect(blocked).toBeInstanceOf(InfraProviderRateLimitedError)
    expect(fetchCount()).toBe(1)
    expect((blocked as InfraProviderRateLimitedError).context).toEqual({ retryAfterSeconds: 10 })

    clock.current += 9_000
    await captureError(() => gateway.getBillingCycle())
    expect(fetchCount()).toBe(1)

    clock.current += 1_000
    await gateway.getBillingCycle()
    expect(fetchCount()).toBe(2)
  })

  it('aceita Retry-After como data HTTP', async () => {
    const date = new Date(START_MILLISECONDS + 20_000).toUTCString()
    const { gateway } = buildHarness({ 'Retry-After': date })

    const first = await captureError(() => gateway.getBillingCycle())

    expect((first as InfraProviderRateLimitedError).context).toEqual({ retryAfterSeconds: 20 })
  })

  it('usa X-RateLimit-Reset (epoch em segundos) quando falta Retry-After', async () => {
    const reset = String(Math.floor(START_MILLISECONDS / 1000) + 45)
    const { gateway } = buildHarness({ 'X-RateLimit-Reset': reset })

    const first = await captureError(() => gateway.getBillingCycle())

    expect((first as InfraProviderRateLimitedError).context).toEqual({ retryAfterSeconds: 45 })
  })

  it('sem header espera 30 s', async () => {
    const { gateway, clock, fetchCount } = buildHarness({})

    await captureError(() => gateway.getBillingCycle())
    clock.current += 29_000
    await captureError(() => gateway.getBillingCycle())
    expect(fetchCount()).toBe(1)

    clock.current += 1_000
    await gateway.getBillingCycle()
    expect(fetchCount()).toBe(2)
  })

  it('header gigante e limitado a 5 minutos', async () => {
    const { gateway, clock, fetchCount } = buildHarness({ 'Retry-After': '86400' })

    const first = await captureError(() => gateway.getBillingCycle())
    expect((first as InfraProviderRateLimitedError).context).toEqual({ retryAfterSeconds: 300 })

    clock.current += 300_000
    await gateway.getBillingCycle()
    expect(fetchCount()).toBe(2)
  })
})
