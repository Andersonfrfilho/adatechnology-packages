/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createHmac } from 'node:crypto'

import type { LockoutKey, LockoutSubject } from './loginLockout.types'

const PART_SEPARATOR = '\u001f'
const NO_PARTITION = ''

function normalizeParts(identifier: string | readonly string[]): string {
  const parts = typeof identifier === 'string' ? [identifier] : identifier
  return parts.map((part) => part.trim().toLowerCase()).join(PART_SEPARATOR)
}

/** HMAC-SHA256 hex of the subject. The identifier (phone, e-mail, IP) is never stored or logged in clear. */
export function toLockoutKey(params: { readonly subject: LockoutSubject; readonly secret: string }): LockoutKey {
  const { subject, secret } = params
  const partition = subject.partition ?? NO_PARTITION
  const identifierHash = createHmac('sha256', secret)
    .update(`lockout:${partition}:${subject.scope}:${normalizeParts(subject.identifier)}`)
    .digest('hex')
  return { partition, scope: subject.scope, identifierHash }
}
