/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { openSecret, sealSecret } from './infraSecretCipher'
import { loadInfraSecretKey } from './infraSecretKey'
import { InfraSecretUnreadableError } from '@adatechnology/infra-contracts'

const BAIT = 'ISCA-TOKEN-0123456789'
const KEY_BASE64 = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 3 + 1)).toString('base64')
const key = loadInfraSecretKey(KEY_BASE64)
const otherKey = loadInfraSecretKey(
  Buffer.from(Array.from({ length: 32 }, (_, index) => index * 4 + 1)).toString('base64'),
)
const scope = { provider: 'railway', workspaceId: 'ws-1' }

function seal(): string {
  return sealSecret({ plaintext: BAIT, key, ...scope })
}

function reasonOf(callback: () => unknown): string | undefined {
  try {
    callback()
  } catch (error) {
    if (error instanceof InfraSecretUnreadableError) return error.reason
    throw error
  }
  return undefined
}

function open(sealed: string, overrides: Partial<{ provider: string; workspaceId: string }> = {}, withKey = key) {
  return openSecret({ sealed, key: withKey, ...scope, ...overrides })
}

function replacePart(sealed: string, index: number, value: string): string {
  const parts = sealed.split('.')
  parts[index] = value
  return parts.join('.')
}

function flipFirstByte(part: string): string {
  const bytes = Buffer.from(part, 'base64url')
  bytes[0] = (bytes[0] ?? 0) ^ 0xff
  return bytes.toString('base64url')
}

describe('infraSecretCipher', () => {
  it('round trips', () => {
    expect(open(seal())).toBe(BAIT)
  })

  it('uses the v1.keyId.iv.tag.data format with 12 byte iv and 16 byte tag', () => {
    const parts = seal().split('.')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toBe('v1')
    expect(parts[1]).toBe(key.keyId)
    expect(Buffer.from(parts[2] ?? '', 'base64url')).toHaveLength(12)
    expect(Buffer.from(parts[3] ?? '', 'base64url')).toHaveLength(16)
  })

  it('produces different outputs for the same plaintext', () => {
    expect(seal()).not.toBe(seal())
  })

  it.each([
    [2, 'iv'],
    [3, 'tag'],
    [4, 'data'],
  ])('fails authentication when a byte of the %s part is changed', (index) => {
    const sealed = seal()
    const tampered = replacePart(sealed, index, flipFirstByte(sealed.split('.')[index] ?? ''))
    expect(reasonOf(() => open(tampered))).toBe('authentication_failed')
  })

  it('fails when workspaceId or provider differ on open', () => {
    const sealed = seal()
    expect(reasonOf(() => open(sealed, { workspaceId: 'ws-2' }))).toBe('authentication_failed')
    expect(reasonOf(() => open(sealed, { provider: 'other' }))).toBe('authentication_failed')
  })

  it('reports key_mismatch for a key with another keyId', () => {
    expect(reasonOf(() => open(seal(), {}, otherKey))).toBe('key_mismatch')
  })

  it('rejects a truncated tag and a short iv as malformed', () => {
    const sealed = seal()
    const shortTag = Buffer.from(sealed.split('.')[3] ?? '', 'base64url')
      .subarray(0, 8)
      .toString('base64url')
    const shortIv = Buffer.from(sealed.split('.')[2] ?? '', 'base64url')
      .subarray(0, 8)
      .toString('base64url')
    expect(reasonOf(() => open(replacePart(sealed, 3, shortTag)))).toBe('malformed')
    expect(reasonOf(() => open(replacePart(sealed, 2, shortIv)))).toBe('malformed')
  })

  it('rejects wrong part counts and the v2 prefix as malformed', () => {
    const sealed = seal()
    expect(reasonOf(() => open(sealed.split('.').slice(0, 4).join('.')))).toBe('malformed')
    expect(reasonOf(() => open(`${sealed}.extra`))).toBe('malformed')
    expect(reasonOf(() => open(replacePart(sealed, 0, 'v2')))).toBe('malformed')
    expect(reasonOf(() => open(''))).toBe('malformed')
  })

  it('rejects an empty plaintext', () => {
    expect(() => sealSecret({ plaintext: '', key, ...scope })).toThrow()
  })

  it('never puts plaintext, key or format parts in error messages', () => {
    const sealed = seal()
    const messages: string[] = []
    const attempts = [
      () => open(replacePart(sealed, 4, flipFirstByte(sealed.split('.')[4] ?? ''))),
      () => open(sealed, {}, otherKey),
      () => open('v2.a.b.c.d'),
      () => open(sealed, { workspaceId: 'ws-2' }),
    ]
    for (const attempt of attempts) {
      try {
        attempt()
      } catch (error) {
        const failure = error as InfraSecretUnreadableError
        messages.push(`${failure.message}${JSON.stringify(failure.context ?? {})}${String(failure)}`)
      }
    }
    expect(messages).toHaveLength(attempts.length)
    for (const message of messages) {
      expect(message).not.toContain(BAIT)
      expect(message).not.toContain(KEY_BASE64)
      for (const part of sealed.split('.').slice(2)) expect(message).not.toContain(part)
    }
  })
})
