import { describe, expect, it } from 'bun:test'

import { formatPhone, isTestContactNumber, phoneCountryFlag } from './phone'

describe('número de teste do simulador', () => {
  it('começando com 0 não vira telefone mascarado nem ganha bandeira', () => {
    expect(isTestContactNumber('05511900001234')).toBe(true)
    expect(formatPhone('05511900001234')).toBe('Contato de teste 1234')
    expect(phoneCountryFlag('05511900001234')).toBe('')
  })

  it('telefone real continua formatado', () => {
    expect(isTestContactNumber('5511900001234')).toBe(false)
    expect(formatPhone('5511900001234')).toBe('+55 (11) 90000-1234')
  })

  it('id opaco com letras não é confundido com número de teste', () => {
    expect(isTestContactNumber('0a1b2c3d-uuid')).toBe(false)
  })
})
