/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { Buffer } from 'node:buffer'

import type { SecretKeyRing } from '../src'

export const PLAINTEXT_SENTINEL = 'pfx-password-sentinel'
export const AAD_SENTINEL = 'transportada:certificate:v1:company:certificate:cte'

type CreateKeyRingOptions = Readonly<{
  activeKeyId?: string
  keys?: Readonly<Record<string, Uint8Array>>
}>

export function createKey(fill = 17): Uint8Array {
  return new Uint8Array(32).fill(fill)
}

export function createKeyRing(options: CreateKeyRingOptions = {}): SecretKeyRing {
  const activeKeyId = options.activeKeyId ?? 'key-v1'

  return {
    activeKeyId,
    keys: options.keys ?? { [activeKeyId]: createKey() },
  }
}

export function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function toBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

export function alterBase64Url(value: string): string {
  const firstCharacter = value.at(0) === 'A' ? 'B' : 'A'
  return `${firstCharacter}${value.slice(1)}`
}

export function alterLastByteBase64Url(value: string): string {
  const bytes = new Uint8Array(Buffer.from(value, 'base64url'))
  const lastByteIndex = bytes.byteLength - 1
  bytes[lastByteIndex] = (bytes[lastByteIndex] ?? 0) ^ 1
  return toBase64Url(bytes)
}

export function frameFields(fields: readonly Uint8Array[]): Uint8Array {
  const size = fields.reduce((total, field) => total + 4 + field.byteLength, 0)
  const frame = new Uint8Array(size)
  const view = new DataView(frame.buffer)
  let offset = 0

  for (const field of fields) {
    view.setUint32(offset, field.byteLength, false)
    offset += 4
    frame.set(field, offset)
    offset += field.byteLength
  }

  return frame
}

export async function captureFailure(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation()
  } catch (error: unknown) {
    return error
  }

  throw new Error('Expected operation to fail')
}
