/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { currentHHmmInTimezone, isWithinQuietHours, nextAllowedInstant } from './quietHours'
import { planDeliveries } from './planDeliveries'

describe('isWithinQuietHours', () => {
  it('trata janela que atravessa a meia-noite como "ou"', () => {
    const window = { start: '22:00', end: '07:00' }
    expect(isWithinQuietHours({ currentHHmm: '23:30', ...window })).toBe(true)
    expect(isWithinQuietHours({ currentHHmm: '03:00', ...window })).toBe(true)
    expect(isWithinQuietHours({ currentHHmm: '12:00', ...window })).toBe(false)
    // Fronteiras: início é inclusivo, fim é exclusivo.
    expect(isWithinQuietHours({ currentHHmm: '22:00', ...window })).toBe(true)
    expect(isWithinQuietHours({ currentHHmm: '07:00', ...window })).toBe(false)
  })

  it('trata janela dentro do mesmo dia', () => {
    const window = { start: '13:00', end: '14:00' }
    expect(isWithinQuietHours({ currentHHmm: '13:30', ...window })).toBe(true)
    expect(isWithinQuietHours({ currentHHmm: '15:00', ...window })).toBe(false)
  })
})

describe('currentHHmmInTimezone', () => {
  it('converte UTC para o horário local do fuso', () => {
    // 02:30 UTC = 23:30 do dia anterior em São Paulo (UTC-3).
    expect(currentHHmmInTimezone('America/Sao_Paulo', new Date('2026-08-02T02:30:00.000Z'))).toBe('23:30')
    expect(currentHHmmInTimezone('UTC', new Date('2026-08-02T02:30:00.000Z'))).toBe('02:30')
  })
})

describe('nextAllowedInstant', () => {
  it('devolve o próximo fim de janela no fuso do destinatário', () => {
    // 23:30 em São Paulo → próximo 07:00 local = 10:00 UTC do mesmo dia civil UTC.
    const next = nextAllowedInstant({
      now: new Date('2026-08-02T02:30:00.000Z'),
      timezone: 'America/Sao_Paulo',
      endHHmm: '07:00',
    })
    expect(next.toISOString()).toBe('2026-08-02T10:00:00.000Z')
  })

  it('empurra para o dia seguinte quando o horário de fim já passou hoje', () => {
    // 12:00 em São Paulo, janela terminando às 07:00 → só amanhã.
    const next = nextAllowedInstant({
      now: new Date('2026-08-02T15:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      endHHmm: '07:00',
    })
    expect(next.toISOString()).toBe('2026-08-03T10:00:00.000Z')
  })

  it('funciona em fuso que ainda pratica DST (Nova York, horário de verão)', () => {
    // 02:30 UTC em agosto = 22:30 do dia anterior em NY (EDT, UTC-4).
    const now = new Date('2026-08-02T02:30:00.000Z')
    expect(currentHHmmInTimezone('America/New_York', now)).toBe('22:30')
    const next = nextAllowedInstant({ now, timezone: 'America/New_York', endHHmm: '07:00' })
    // 07:00 EDT = 11:00 UTC.
    expect(next.toISOString()).toBe('2026-08-02T11:00:00.000Z')
  })
})

describe('planDeliveries — quiet hours', () => {
  const availableChannels = new Set(['inbox', 'push', 'email'] as const)
  const quietHoursByChannel = new Map([['push', { start: '22:00', end: '07:00', timezone: 'America/Sao_Paulo' }]])

  it('reagenda canal intrusivo dentro da janela, e não o inbox', () => {
    const plan = planDeliveries({
      category: 'order_status',
      explicitChannels: ['inbox', 'push'],
      availableChannels: availableChannels as never,
      preferences: [],
      quietHoursByChannel: quietHoursByChannel as never,
      now: new Date('2026-08-02T02:30:00.000Z'), // 23:30 em SP
    })

    const push = plan.find((entry) => entry.channel === 'push')
    const inbox = plan.find((entry) => entry.channel === 'inbox')
    expect(push?.action).toBe('reschedule')
    expect(push?.reason).toBe('quiet_hours')
    expect(push?.scheduledFor?.toISOString()).toBe('2026-08-02T10:00:00.000Z')
    expect(inbox?.action).toBe('send')
  })

  it('não mexe em nada fora da janela', () => {
    const plan = planDeliveries({
      category: 'order_status',
      explicitChannels: ['push'],
      availableChannels: availableChannels as never,
      preferences: [],
      quietHoursByChannel: quietHoursByChannel as never,
      now: new Date('2026-08-02T15:00:00.000Z'), // 12:00 em SP
    })

    expect(plan[0]?.action).toBe('send')
  })

  it('e-mail não é intrusivo — passa mesmo com janela configurada para ele', () => {
    const plan = planDeliveries({
      category: 'order_status',
      explicitChannels: ['email'],
      availableChannels: availableChannels as never,
      preferences: [],
      quietHoursByChannel: new Map([
        ['email', { start: '22:00', end: '07:00', timezone: 'America/Sao_Paulo' }],
      ]) as never,
      now: new Date('2026-08-02T02:30:00.000Z'),
    })

    expect(plan[0]?.action).toBe('send')
  })
})

describe('planDeliveries — preferências', () => {
  const availableChannels = new Set(['inbox', 'push', 'email'] as const)

  it('categoria sem linha de preferência é opt-out: o canal entra por padrão', () => {
    const plan = planDeliveries({
      category: 'categoria_nova',
      availableChannels: availableChannels as never,
      preferences: [],
      now: new Date('2026-08-02T15:00:00.000Z'),
    })

    expect(plan.map((entry) => entry.channel).sort()).toEqual(['email', 'inbox', 'push'])
  })

  it('canal desligado na preferência não vira candidato', () => {
    const plan = planDeliveries({
      category: 'order_status',
      availableChannels: availableChannels as never,
      preferences: [{ category: 'order_status', channel: 'push', enabled: false }],
      now: new Date('2026-08-02T15:00:00.000Z'),
    })

    expect(plan.map((entry) => entry.channel)).not.toContain('push')
  })

  it('canais explícitos ignoram a preferência — o chamador já decidiu', () => {
    const plan = planDeliveries({
      category: 'order_status',
      explicitChannels: ['push'],
      availableChannels: availableChannels as never,
      preferences: [{ category: 'order_status', channel: 'push', enabled: false }],
      now: new Date('2026-08-02T15:00:00.000Z'),
    })

    expect(plan[0]?.channel).toBe('push')
    expect(plan[0]?.action).toBe('send')
  })

  it('canal pedido explicitamente mas sem driver configurado vira skip, não erro', () => {
    const plan = planDeliveries({
      category: 'order_status',
      explicitChannels: ['sms'],
      availableChannels: availableChannels as never,
      preferences: [],
      now: new Date('2026-08-02T15:00:00.000Z'),
    })

    expect(plan[0]?.action).toBe('skip')
    expect(plan[0]?.reason).toBe('channel_not_configured')
  })
})
