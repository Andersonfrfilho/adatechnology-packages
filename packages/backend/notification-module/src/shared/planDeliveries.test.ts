/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Três camadas decidem por onde a notificação sai, e a ordem entre elas é o contrato: política da
 * empresa (teto), canais explícitos do chamador, preferência de quem recebe. Inverter qualquer par
 * produz mensagem enviada por canal que a empresa desligou — ou silêncio que ninguém pediu.
 */

import { describe, expect, it } from 'bun:test'

import { planDeliveries } from './planDeliveries'
import type { PlanDeliveriesParams } from './planDeliveries'

const NOW = new Date('2026-08-24T12:00:00.000Z')

function build(overrides: Partial<PlanDeliveriesParams> = {}): PlanDeliveriesParams {
  return {
    category: 'billing',
    availableChannels: new Set(['inbox', 'email', 'sms'] as const),
    preferences: [],
    now: NOW,
    ...overrides,
  }
}

describe('política da empresa', () => {
  it('barra o canal desligado, com razão registrada em vez de sumiço', () => {
    const plan = planDeliveries(build({ policies: [{ category: 'billing', channel: 'sms', enabled: false }] }))

    expect(plan.find((planned) => planned.channel === 'sms')).toEqual({
      channel: 'sms',
      action: 'skip',
      reason: 'disabled_by_policy',
    })
  })

  it('vale sobre canais explícitos do chamador — senão a política seria decorativa', () => {
    const plan = planDeliveries(
      build({
        explicitChannels: ['sms'],
        policies: [{ category: 'billing', channel: 'sms', enabled: false }],
      }),
    )

    expect(plan.every((planned) => planned.action === 'skip')).toBe(true)
  })

  it('não vaza para outra categoria', () => {
    const plan = planDeliveries(
      build({ category: 'order', policies: [{ category: 'billing', channel: 'sms', enabled: false }] }),
    )

    expect(plan.find((planned) => planned.channel === 'sms')?.action).toBe('send')
  })

  it('linha ausente é permissão: sem política, tudo segue como antes', () => {
    const plan = planDeliveries(build())

    expect(plan.every((planned) => planned.action === 'send')).toBe(true)
  })

  it('preferência do usuário não reabre canal que a política fechou', () => {
    const plan = planDeliveries(
      build({
        preferences: [{ category: 'billing', channel: 'sms', enabled: true }],
        policies: [{ category: 'billing', channel: 'sms', enabled: false }],
      }),
    )

    expect(plan.find((planned) => planned.channel === 'sms')?.action).toBe('skip')
  })

  it('política ligada não força canal que o usuário desligou — o teto não é um piso', () => {
    const plan = planDeliveries(
      build({
        preferences: [{ category: 'billing', channel: 'sms', enabled: false }],
        policies: [{ category: 'billing', channel: 'sms', enabled: true }],
      }),
    )

    expect(plan.some((planned) => planned.channel === 'sms')).toBe(false)
  })
})
