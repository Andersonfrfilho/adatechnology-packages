import { describe, expect, it } from 'bun:test'

import { INITIAL_PROTOCOL_COPY_STATE, copyProtocolToClipboard, protocolCopyReducer } from './participantProtocolCopy'

describe('copyProtocolToClipboard', () => {
  it('writes the protocol and reports success', async () => {
    const written: string[] = []
    const clipboard = { writeText: async (text: string) => void written.push(text) }
    expect(await copyProtocolToClipboard('261009-K7M2', clipboard)).toBe(true)
    expect(written).toEqual(['261009-K7M2'])
  })

  it('reports failure silently when the clipboard rejects', async () => {
    const clipboard = { writeText: async () => Promise.reject(new Error('denied')) }
    expect(await copyProtocolToClipboard('261009-K7M2', clipboard)).toBe(false)
  })

  it('reports failure when there is no clipboard', async () => {
    expect(await copyProtocolToClipboard('261009-K7M2', undefined)).toBe(false)
  })
})

describe('protocolCopyReducer', () => {
  it('starts not copied', () => {
    expect(INITIAL_PROTOCOL_COPY_STATE).toEqual({ copyCount: 0, isCopied: false })
  })

  it('a copy marks it copied and counts it', () => {
    expect(protocolCopyReducer(INITIAL_PROTOCOL_COPY_STATE, { type: 'copied' })).toEqual({
      copyCount: 1,
      isCopied: true,
    })
  })

  it('a second copy while still copied bumps the counter so the timer restarts and the notice is announced again', () => {
    const first = protocolCopyReducer(INITIAL_PROTOCOL_COPY_STATE, { type: 'copied' })
    const second = protocolCopyReducer(first, { type: 'copied' })
    expect(second).toEqual({ copyCount: 2, isCopied: true })
  })

  it('expiry clears the notice and keeps the count', () => {
    const copied = protocolCopyReducer(INITIAL_PROTOCOL_COPY_STATE, { type: 'copied' })
    expect(protocolCopyReducer(copied, { type: 'expired' })).toEqual({ copyCount: 1, isCopied: false })
  })
})
