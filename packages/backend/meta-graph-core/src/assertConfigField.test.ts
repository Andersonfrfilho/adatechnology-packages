/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { assertConfigField } from './assertConfigField'
import { WhatsAppConfigError } from './errors/MetaGraphError'

describe('assertConfigField', () => {
  it('returns the value when it is defined and non-empty', () => {
    expect(assertConfigField('phone-number-id', 'phoneNumberId')).toBe('phone-number-id')
  })

  it('throws WhatsAppConfigError when the value is undefined', () => {
    expect(() => assertConfigField(undefined, 'phoneNumberId')).toThrow(WhatsAppConfigError)
  })

  it('throws WhatsAppConfigError when the value is an empty string', () => {
    expect(() => assertConfigField('', 'accessToken')).toThrow(WhatsAppConfigError)
  })

  it('names the missing field in the thrown error', () => {
    try {
      assertConfigField(undefined, 'accessToken')
      throw new Error('expected assertConfigField to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppConfigError)
      expect((error as WhatsAppConfigError).providerMessage).toBe('accessToken')
    }
  })
})
