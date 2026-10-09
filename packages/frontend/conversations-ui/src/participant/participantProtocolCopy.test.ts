import { describe, expect, it } from 'bun:test'

import { copyProtocolToClipboard } from './participantProtocolCopy'

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
