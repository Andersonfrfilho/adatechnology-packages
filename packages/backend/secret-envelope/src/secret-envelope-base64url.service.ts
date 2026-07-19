/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { Buffer } from 'node:buffer'

import { SecretEnvelopeError } from './secret-envelope.error'

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

type DecodeCanonicalBase64UrlInput = Readonly<{
  value: string
  maximumDecodedBytes: number
}>

export function encodeCanonicalBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function decodeCanonicalBase64Url(input: DecodeCanonicalBase64UrlInput): Uint8Array<ArrayBuffer> {
  const maximumEncodedLength = Math.ceil((input.maximumDecodedBytes * 4) / 3)

  if (input.value.length > maximumEncodedLength || !BASE64URL_PATTERN.test(input.value)) {
    throw new SecretEnvelopeError('INVALID_ENVELOPE')
  }

  const decoded = new Uint8Array(Buffer.from(input.value, 'base64url'))

  if (decoded.byteLength > input.maximumDecodedBytes || encodeCanonicalBase64Url(decoded) !== input.value) {
    throw new SecretEnvelopeError('INVALID_ENVELOPE')
  }

  return decoded
}
