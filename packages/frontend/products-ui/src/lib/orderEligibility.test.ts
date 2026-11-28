import { describe, expect, it } from 'bun:test'

import {
  buildOrderEligibility,
  toOrderEligibilityDraft,
  validateOrderEligibility,
  withoutOrderEligibility,
} from './orderEligibility'

describe('orderEligibility draft', () => {
  it('produto sem a chave abre como sem restrição / todos', () => {
    expect(toOrderEligibilityDraft(undefined)).toEqual({ minimumAge: '', audience: 'everyone' })
    expect(toOrderEligibilityDraft({ capacity: 2 })).toEqual({ minimumAge: '', audience: 'everyone' })
  })

  it('lê idade e público guardados', () => {
    const draft = toOrderEligibilityDraft({ orderEligibility: { minimumAge: 18, audience: 'staying_guests' } })
    expect(draft).toEqual({ minimumAge: '18', audience: 'staying_guests' })
  })

  it('idade null é sem restrição', () => {
    expect(toOrderEligibilityDraft({ orderEligibility: { minimumAge: null } }).minimumAge).toBe('')
  })

  it('sem restrição nenhuma não grava a chave', () => {
    expect(buildOrderEligibility({ minimumAge: '', audience: 'everyone' })).toBeUndefined()
  })

  it('grava só o que foi definido', () => {
    expect(buildOrderEligibility({ minimumAge: '18', audience: 'everyone' })).toEqual({ minimumAge: 18 })
    expect(buildOrderEligibility({ minimumAge: '', audience: 'staying_guests' })).toEqual({
      audience: 'staying_guests',
    })
    expect(buildOrderEligibility({ minimumAge: '0', audience: 'everyone' })).toEqual({ minimumAge: 0 })
  })

  it('valida a faixa 0..21', () => {
    expect(validateOrderEligibility({ minimumAge: '', audience: 'everyone' })).toBe(true)
    expect(validateOrderEligibility({ minimumAge: '21', audience: 'everyone' })).toBe(true)
    expect(validateOrderEligibility({ minimumAge: '22', audience: 'everyone' })).toBe(false)
  })

  it('withoutOrderEligibility preserva as outras chaves', () => {
    expect(withoutOrderEligibility({ a: 1, orderEligibility: { minimumAge: 18 } })).toEqual({ a: 1 })
  })
})
