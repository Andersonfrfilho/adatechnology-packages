/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { availabilityScheduleSchema, isAvailableAt, type AvailabilitySchedule } from './availabilitySchedule'
import { createProductSchema, updateProductSchema } from './schemas'

// 2026-11-25 é quarta-feira.
const WEDNESDAY_NOON_UTC = new Date('2026-11-25T12:00:00Z')

describe('isAvailableAt', () => {
  it('sem agenda, sempre disponível', () => {
    expect(isAvailableAt({ schedule: null, at: WEDNESDAY_NOON_UTC })).toBe(true)
    expect(isAvailableAt({ schedule: undefined, at: WEDNESDAY_NOON_UTC })).toBe(true)
  })

  it('só dias da semana, sem horário', () => {
    const schedule: AvailabilitySchedule = { weekdays: [3] }
    expect(isAvailableAt({ schedule, at: WEDNESDAY_NOON_UTC })).toBe(true)
    expect(isAvailableAt({ schedule: { weekdays: [4] }, at: WEDNESDAY_NOON_UTC })).toBe(false)
  })

  it('janela de horário: início inclusivo, fim exclusivo', () => {
    const schedule: AvailabilitySchedule = { weekdays: [3], from: '11:00', until: '15:00' }
    expect(isAvailableAt({ schedule, at: new Date('2026-11-25T11:00:00Z') })).toBe(true)
    expect(isAvailableAt({ schedule, at: new Date('2026-11-25T14:59:00Z') })).toBe(true)
    expect(isAvailableAt({ schedule, at: new Date('2026-11-25T15:00:00Z') })).toBe(false)
    expect(isAvailableAt({ schedule, at: new Date('2026-11-25T10:59:00Z') })).toBe(false)
  })

  it('avalia no fuso configurado, inclusive virando o dia', () => {
    // 01:00Z de quinta = 22:00 de quarta em São Paulo (UTC-3).
    const at = new Date('2026-11-26T01:00:00Z')
    const schedule: AvailabilitySchedule = { weekdays: [3], from: '18:00', until: '23:00' }
    expect(isAvailableAt({ schedule, at })).toBe(false)
    expect(isAvailableAt({ schedule, at, defaultTimeZone: 'America/Sao_Paulo' })).toBe(true)
    expect(isAvailableAt({ schedule: { ...schedule, timeZone: 'America/Sao_Paulo' }, at })).toBe(true)
  })

  it('janela que cruza a madrugada pertence ao dia de início', () => {
    const schedule: AvailabilitySchedule = { weekdays: [5], from: '22:00', until: '02:00' }
    expect(isAvailableAt({ schedule, at: new Date('2026-11-27T23:00:00Z') })).toBe(true) // sexta 23h
    expect(isAvailableAt({ schedule, at: new Date('2026-11-28T01:00:00Z') })).toBe(true) // sábado 01h
    expect(isAvailableAt({ schedule, at: new Date('2026-11-28T03:00:00Z') })).toBe(false)
    expect(isAvailableAt({ schedule, at: new Date('2026-11-26T01:00:00Z') })).toBe(false) // quinta 01h
  })

  it('só from ou só until', () => {
    expect(isAvailableAt({ schedule: { weekdays: [3], from: '13:00' }, at: WEDNESDAY_NOON_UTC })).toBe(false)
    expect(isAvailableAt({ schedule: { weekdays: [3], until: '13:00' }, at: WEDNESDAY_NOON_UTC })).toBe(true)
  })
})

describe('availabilityScheduleSchema', () => {
  it.each([
    [{ weekdays: [] }, false],
    [{ weekdays: [1, 1] }, false],
    [{ weekdays: [7] }, false],
    [{ weekdays: [1], from: '9:00' }, false],
    [{ weekdays: [1], from: '10:00', until: '10:00' }, false],
    [{ weekdays: [1], timeZone: 'Mars/Base' }, false],
    [{ weekdays: [1, 2], from: '10:00', until: '22:30', timeZone: 'America/Sao_Paulo' }, true],
    [{ weekdays: [0] }, true],
  ])('%j -> %s', (value, expected) => {
    expect(availabilityScheduleSchema.safeParse(value).success).toBe(expected)
  })
})

describe('preço sob consulta, agenda e attributes nos schemas de produto', () => {
  it('aceita priceInCents null, mas exige a chave', () => {
    expect(createProductSchema.safeParse({ name: 'Pacote', priceInCents: null }).success).toBe(true)
    expect(createProductSchema.safeParse({ name: 'Pacote' }).success).toBe(false)
  })

  it('update aceita limpar preço e agenda com null', () => {
    const parsed = updateProductSchema.parse({ priceInCents: null, availabilitySchedule: null })
    expect(parsed.priceInCents).toBeNull()
    expect(parsed.availabilitySchedule).toBeNull()
  })

  it('attributes: objeto livre com teto de tamanho', () => {
    const base = { name: 'Quarto', priceInCents: null }
    expect(createProductSchema.safeParse({ ...base, attributes: { capacity: 4, includes: ['café'] } }).success).toBe(true)
    expect(createProductSchema.safeParse({ ...base, attributes: 'x' }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...base, attributes: { blob: 'x'.repeat(20_000) } }).success).toBe(false)
  })
})
