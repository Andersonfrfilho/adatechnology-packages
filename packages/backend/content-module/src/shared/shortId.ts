/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { randomInt } from 'node:crypto'
import { SHORT_ID_LENGTH } from '@adatechnology/content-contracts'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 6 caracteres base36 (~2 bilhões): a colisão é checada contra a empresa antes de gravar. */
export function generateShortId(): string {
  let value = ''
  for (let index = 0; index < SHORT_ID_LENGTH; index += 1) value += ALPHABET[randomInt(ALPHABET.length)]
  return value
}
