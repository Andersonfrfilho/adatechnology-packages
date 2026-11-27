/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Código de uso único: gerado aqui, gravado só como HMAC (preso à pessoa e ao número) e comparado em
 * tempo constante. O canal que o entrega nunca o guarda.
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export const DEFAULT_CODE_LENGTH = 6
export const DEFAULT_CODE_EXPIRES_IN_SECONDS = 10 * 60
export const DEFAULT_CODE_MAX_ATTEMPTS = 5
export const DEFAULT_RESEND_COOLDOWN_SECONDS = 60

export function generateVerificationCode(length: number): string {
  let code = ''
  for (let index = 0; index < length; index += 1) code += String(randomInt(0, 10))
  return code
}

export function hashVerificationCode(params: {
  readonly code: string
  readonly userId: string
  readonly phone: string
  readonly secret: string
}): string {
  return createHmac('sha256', params.secret).update(`${params.userId}:${params.phone}:${params.code}`).digest('hex')
}

export function isSameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex')
  const rightBytes = Buffer.from(right, 'hex')
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}
