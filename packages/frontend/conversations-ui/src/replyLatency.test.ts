/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A distinção que estes testes protegem: janela de sessão e tempo sem resposta medem coisas
 * diferentes, e reaproveitar `windowOf` para o SLA marcaria como atrasada toda conversa já
 * respondida — o alerta apontaria para tudo, ou seja, para nada.
 */

import { describe, expect, it } from 'bun:test'

import { REPLY_LATENCY, isReplyOverdue, replyLatencyOf } from './replyLatency'

const NOW = new Date('2026-08-29T12:00:00Z').getTime()
const hoursAgo = (hours: number) => new Date(NOW - hours * 60 * 60 * 1000).toISOString()

describe('faixas de espera', () => {
  it('até 6h está dentro do combinado', () => {
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(0), now: NOW })).toBe(
      REPLY_LATENCY.WITHIN,
    )
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(5.9), now: NOW })).toBe(
      REPLY_LATENCY.WITHIN,
    )
  })

  it('de 6h a 12h já passou do combinado', () => {
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(6), now: NOW })).toBe(REPLY_LATENCY.LATE)
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(11.9), now: NOW })).toBe(
      REPLY_LATENCY.LATE,
    )
  })

  it('acima de 12h é crítico — não se confunde com uma espera de 7h', () => {
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(12), now: NOW })).toBe(
      REPLY_LATENCY.CRITICAL,
    )
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(72), now: NOW })).toBe(
      REPLY_LATENCY.CRITICAL,
    )
  })
})

describe('quando não há espera a mostrar', () => {
  it('conversa já respondida não tem selo, por mais antiga que seja', () => {
    // É aqui que o SLA se separa da janela de sessão: `windowOf` marcaria isto como crítico.
    expect(replyLatencyOf({ lastDirection: 'outbound', lastInboundAt: hoursAgo(20), now: NOW })).toBeNull()
  })

  it('cliente que nunca escreveu não tem espera', () => {
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: null, now: NOW })).toBeNull()
  })

  it('direção desconhecida não afirma espera', () => {
    expect(replyLatencyOf({ lastInboundAt: hoursAgo(20), now: NOW })).toBeNull()
  })

  it('relógio adiantado não vira conversa crítica', () => {
    expect(replyLatencyOf({ lastDirection: 'inbound', lastInboundAt: hoursAgo(-0.05), now: NOW })).toBe(
      REPLY_LATENCY.WITHIN,
    )
  })
})

describe('o que merece alerta', () => {
  it('só o que passou de 6h', () => {
    expect(isReplyOverdue(REPLY_LATENCY.WITHIN)).toBe(false)
    expect(isReplyOverdue(REPLY_LATENCY.LATE)).toBe(true)
    expect(isReplyOverdue(REPLY_LATENCY.CRITICAL)).toBe(true)
    expect(isReplyOverdue(null)).toBe(false)
  })
})
