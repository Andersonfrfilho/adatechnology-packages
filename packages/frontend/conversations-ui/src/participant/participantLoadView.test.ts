import { describe, expect, it } from 'bun:test'

import { resolveLoadView } from './participantLoadView'

describe('resolveLoadView', () => {
  it('is loading while idle or loading with nothing to show', () => {
    expect(resolveLoadView({ status: 'idle', hasItems: false })).toEqual({ isLoading: true, hasError: false, isEmpty: false })
    expect(resolveLoadView({ status: 'loading', hasItems: false })).toEqual({ isLoading: true, hasError: false, isEmpty: false })
  })

  it('keeps showing items while revalidating', () => {
    expect(resolveLoadView({ status: 'loading', hasItems: true })).toEqual({ isLoading: false, hasError: false, isEmpty: false })
  })

  it('is empty only after a successful load', () => {
    expect(resolveLoadView({ status: 'ready', hasItems: false })).toEqual({ isLoading: false, hasError: false, isEmpty: true })
    expect(resolveLoadView({ status: 'error', hasItems: false })).toEqual({ isLoading: false, hasError: true, isEmpty: false })
  })

  it('reports the error even when items remain on screen', () => {
    expect(resolveLoadView({ status: 'error', hasItems: true }).hasError).toBe(true)
  })
})
