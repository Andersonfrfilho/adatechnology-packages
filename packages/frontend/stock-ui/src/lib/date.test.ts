/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { maskDate, parseDateInput } from './date'

describe('data digitada', () => {
  it('máscara enquanto digita', () => {
    expect(maskDate('01022026')).toBe('01/02/2026')
    expect(maskDate('0a1')).toBe('01')
  })

  it('recusa data que não existe', () => {
    expect(parseDateInput('31/02/2026')).toBeUndefined()
    expect(parseDateInput('2026-02-01')).toBeUndefined()
    expect(new Date(parseDateInput('28/02/2026') ?? '').getDate()).toBe(28)
  })
})
