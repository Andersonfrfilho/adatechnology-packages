import { describe, expect, it } from 'bun:test'

import {
  attributesToEntries,
  buildSchedule,
  entriesToAttributes,
  toggleWeekday,
  validateSchedule,
} from './productFields'

describe('toggleWeekday', () => {
  it('adiciona e remove mantendo a ordem da semana', () => {
    expect(toggleWeekday([5, 1], 3)).toEqual([1, 3, 5])
    expect(toggleWeekday([1, 3, 5], 3)).toEqual([1, 5])
  })
})

describe('attributes <-> entries', () => {
  it('preserva valores que não são texto quando não foram editados', () => {
    const entries = attributesToEntries({ capacity: 4, note: 'ok', includes: ['a', 'b'] })
    expect(entriesToAttributes(entries)).toEqual({ capacity: 4, note: 'ok', includes: ['a', 'b'] })
  })

  it('valor editado vira texto; linha sem chave some', () => {
    const entries = [
      { key: 'capacity', value: '6', original: 4 },
      { key: '  ', value: 'lixo' },
    ]
    expect(entriesToAttributes(entries)).toEqual({ capacity: '6' })
  })
})

describe('schedule', () => {
  it('omite horário e fuso vazios', () => {
    expect(buildSchedule({ weekdays: [1], from: '', until: '', timeZone: ' ' })).toEqual({ weekdays: [1] })
    expect(buildSchedule({ weekdays: [1], from: '10:00', until: '22:00', timeZone: 'America/Sao_Paulo' })).toEqual({
      weekdays: [1],
      from: '10:00',
      until: '22:00',
      timeZone: 'America/Sao_Paulo',
    })
  })

  it('valida dia e intervalo', () => {
    expect(validateSchedule({ weekdays: [], from: '', until: '' })).toBeDefined()
    expect(validateSchedule({ weekdays: [1], from: '10:00', until: '10:00' })).toBeDefined()
    expect(validateSchedule({ weekdays: [1], from: '22:00', until: '02:00' })).toBeUndefined()
  })
})
