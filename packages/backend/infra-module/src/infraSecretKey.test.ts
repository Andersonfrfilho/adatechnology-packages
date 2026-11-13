/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { loadInfraSecretKey } from './infraSecretKey'
import { InfraSecretKeyInvalidError } from '@adatechnology/infra-contracts'

const KEY_BYTES = Uint8Array.from({ length: 32 }, (_, index) => index + 7)
const KEY_BASE64 = Buffer.from(KEY_BYTES).toString('base64')
const OTHER_BASE64 = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 9 + 2)).toString('base64')

describe('loadInfraSecretKey', () => {
  it('loads a 32 byte key and derives a 16 char hex keyId', () => {
    const key = loadInfraSecretKey(KEY_BASE64)
    expect(key.keyId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('keeps keyId stable for the same key and different for another', () => {
    expect(loadInfraSecretKey(KEY_BASE64).keyId).toBe(loadInfraSecretKey(KEY_BASE64).keyId)
    expect(loadInfraSecretKey(OTHER_BASE64).keyId).not.toBe(loadInfraSecretKey(KEY_BASE64).keyId)
  })

  it('exposes the bytes only through use()', () => {
    const key = loadInfraSecretKey(KEY_BASE64)
    expect(key.use((bytes) => Buffer.from(bytes).equals(Buffer.from(KEY_BYTES)))).toBe(true)
  })

  it.each([31, 33, 0])('rejects a key of %i bytes', (length) => {
    expect(() => loadInfraSecretKey(Buffer.alloc(length, 1).toString('base64'))).toThrow(InfraSecretKeyInvalidError)
  })

  it.each([0, 1, 255])('rejects a 32 byte key whose bytes are all %i', (byteValue) => {
    expect(() => loadInfraSecretKey(Buffer.alloc(32, byteValue).toString('base64'))).toThrow(InfraSecretKeyInvalidError)
  })

  it('rejects a 32 byte key with fewer than 16 distinct bytes', () => {
    const lowEntropy = Buffer.from(Array.from({ length: 32 }, (_, index) => index % 15))
    expect(() => loadInfraSecretKey(lowEntropy.toString('base64'))).toThrow(InfraSecretKeyInvalidError)
  })

  it('accepts a key with exactly 16 distinct bytes', () => {
    const boundary = Buffer.from(Array.from({ length: 32 }, (_, index) => index % 16))
    expect(() => loadInfraSecretKey(boundary.toString('base64'))).not.toThrow()
  })

  it('rejects invalid base64', () => {
    expect(() => loadInfraSecretKey('%%%not-base64%%%')).toThrow(InfraSecretKeyInvalidError)
  })

  it('does not leak the key through JSON, String or inspect', () => {
    const key = loadInfraSecretKey(KEY_BASE64)
    const hex = Buffer.from(KEY_BYTES).toString('hex')
    const outputs = [JSON.stringify(key), String(key), Bun.inspect(key), JSON.stringify({ key })]
    for (const output of outputs) {
      expect(output).not.toContain(KEY_BASE64)
      expect(output).not.toContain(hex)
      expect(output).not.toContain(KEY_BYTES.join(','))
    }
  })

  it('does not include the key value in the error message', () => {
    const invalid = Buffer.alloc(31, 1).toString('base64')
    try {
      loadInfraSecretKey(invalid)
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(invalid)
    }
  })
})
