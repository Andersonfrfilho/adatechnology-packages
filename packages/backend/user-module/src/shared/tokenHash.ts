/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { randomBytes, createHash } from 'node:crypto'

const RAW_TOKEN_BYTES = 32

/** Token opaco cru — o que vai para o cliente (URL de reset, cookie de refresh). */
export function generateRawToken(): string {
  return randomBytes(RAW_TOKEN_BYTES).toString('hex')
}

/** sha256 hex do token cru — o que é persistido. O valor cru nunca toca o banco. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}
