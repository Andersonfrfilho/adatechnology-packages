/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Matemática pura de calendário e fatiamento — sem Postgres, sem `ClockPort` (datas fixas passadas
 * por parâmetro). A conversão hora-de-parede → instante (`AT TIME ZONE`, T3.2) fica de fora daqui
 * de propósito: só um Postgres real é DST-safe, ver `Availability.use-cases.integration.test.ts`.
 */

import { describe, expect, test } from 'bun:test'

import { LookaheadWindowTooLargeError } from '@adatechnology/scheduling-contracts'

import {
  addDays,
  computeBlockingWindow,
  formatLocalDate,
  localDateRange,
  sliceIntoSteps,
  validateLookaheadWindow,
  weekdayOfLocalDate,
  windowsOverlap,
} from './availabilitySlicing'

describe('weekdayOfLocalDate', () => {
  test('2026-09-01 é terça-feira (weekday 2)', () => {
    expect(weekdayOfLocalDate({ year: 2026, month: 9, day: 1 })).toBe(2)
  })

  test('2026-09-06 é domingo (weekday 0)', () => {
    expect(weekdayOfLocalDate({ year: 2026, month: 9, day: 6 })).toBe(0)
  })
})

describe('addDays / formatLocalDate', () => {
  test('atravessa virada de mês', () => {
    expect(formatLocalDate(addDays({ year: 2026, month: 9, day: 30 }, 1))).toBe('2026-10-01')
  })
})

describe('localDateRange', () => {
  test('devolve as datas locais cobertas por [from, until)', () => {
    const dates = localDateRange({
      from: new Date('2026-09-01T00:00:00Z'),
      until: new Date('2026-09-04T00:00:00Z'),
      timezone: 'America/Sao_Paulo',
    })
    expect(dates.map(formatLocalDate)).toEqual(['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'])
  })

  test('janela vazia (until <= from) não gera data', () => {
    const dates = localDateRange({
      from: new Date('2026-09-01T00:00:00Z'),
      until: new Date('2026-09-01T00:00:00Z'),
      timezone: 'UTC',
    })
    expect(dates).toEqual([])
  })
})

describe('sliceIntoSteps', () => {
  test('sem buffer, fatias ficam coladas', () => {
    const candidates = sliceIntoSteps({
      window: { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') },
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })
    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.during.end).toEqual(candidates[1]!.during.start)
  })

  // T3.3: dois atendimentos colados sem respeitar o buffer não podem os dois aparecer livres —
  // o passo já embute o buffer, então o segundo candidato só nasce depois que o primeiro +
  // buffer termina.
  test('com buffer depois, dois candidatos vizinhos nunca ficam mais próximos que o buffer exige', () => {
    const candidates = sliceIntoSteps({
      window: { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') },
      durationMinutes: 20,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
    })
    expect(candidates).toHaveLength(2)
    const gapMinutes = (candidates[1]!.during.start.getTime() - candidates[0]!.during.end.getTime()) / 60_000
    expect(gapMinutes).toBe(10)
  })

  // F-005: o buffer "antes" precisa deslocar o `during` mostrado ao cliente, não só encolher o
  // espaço entre candidatos — senão a reserva criada a partir desse horário bloqueia um intervalo
  // diferente do que a disponibilidade calculou (ver computeBlockingWindow abaixo).
  test('com buffer antes, o during nasce deslocado do início do blocking', () => {
    const candidates = sliceIntoSteps({
      window: { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') },
      durationMinutes: 20,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 0,
    })
    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.blocking.start).toEqual(new Date('2026-09-01T09:00:00Z'))
    expect(candidates[0]!.during.start).toEqual(new Date('2026-09-01T09:10:00Z'))
    expect(candidates[0]!.during.end).toEqual(new Date('2026-09-01T09:30:00Z'))
  })

  test('o blocking inteiro precisa caber na janela — nunca invade além do fim da regra', () => {
    const candidates = sliceIntoSteps({
      window: { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T09:35:00Z') },
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 10,
    })
    expect(candidates).toHaveLength(0)
  })
})

describe('computeBlockingWindow', () => {
  // F-005: mesma função usada por Booking.use-cases.ts — uma reserva criada com o `during` exibido
  // pela disponibilidade tem que reproduzir exatamente o `blocking` que a disponibilidade calculou.
  test('aplica bufferBefore no início e bufferAfter no fim do during', () => {
    const blocking = computeBlockingWindow({
      during: { start: new Date('2026-09-01T09:10:00Z'), end: new Date('2026-09-01T09:30:00Z') },
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 5,
    })
    expect(blocking).toEqual({
      start: new Date('2026-09-01T09:00:00Z'),
      end: new Date('2026-09-01T09:35:00Z'),
    })
  })
})

describe('windowsOverlap', () => {
  test('faixas que se tocam no limite (bound "[)") não sobrepõem', () => {
    const a = { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') }
    const b = { start: new Date('2026-09-01T10:00:00Z'), end: new Date('2026-09-01T11:00:00Z') }
    expect(windowsOverlap(a, b)).toBe(false)
  })

  test('faixas parcialmente sobrepostas sobrepõem', () => {
    const a = { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') }
    const b = { start: new Date('2026-09-01T09:30:00Z'), end: new Date('2026-09-01T10:30:00Z') }
    expect(windowsOverlap(a, b)).toBe(true)
  })
})

describe('validateLookaheadWindow', () => {
  test('janela dentro do teto não lança', () => {
    expect(() =>
      validateLookaheadWindow({
        from: new Date('2026-09-01T00:00:00Z'),
        until: new Date('2026-09-10T00:00:00Z'),
        maxLookaheadDays: 30,
      }),
    ).not.toThrow()
  })

  // T3.5: consulta de anos é varredura acidental.
  test('janela acima do teto lança LookaheadWindowTooLargeError', () => {
    expect(() =>
      validateLookaheadWindow({
        from: new Date('2026-09-01T00:00:00Z'),
        until: new Date('2031-09-01T00:00:00Z'),
        maxLookaheadDays: 90,
      }),
    ).toThrow(LookaheadWindowTooLargeError)
  })
})
