/**
 * A classificação de janela decide se o atendente pode mandar texto livre. Errar a fronteira não
 * quebra a tela — faz o WhatsApp recusar o envio depois, longe da causa.
 */

import { describe, expect, it } from 'bun:test'
import { CONVERSATION_WINDOW, formatStalledFor, windowOf } from './conversationWindow'
import { CONVERSATION_CHANNEL, contactFlag, formatContactHandle } from './conversationChannel'

const NOW = new Date('2026-07-27T12:00:00.000Z').getTime()
const HOUR = 60 * 60 * 1000

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString()
}

describe('windowOf', () => {
  it('classifica por faixa de horas desde o último contato do cliente', () => {
    expect(windowOf({ lastInboundAt: hoursAgo(0), now: NOW })).toBe(CONVERSATION_WINDOW.FRESH)
    expect(windowOf({ lastInboundAt: hoursAgo(11.9), now: NOW })).toBe(CONVERSATION_WINDOW.FRESH)
    expect(windowOf({ lastInboundAt: hoursAgo(15), now: NOW })).toBe(CONVERSATION_WINDOW.WARNING)
    expect(windowOf({ lastInboundAt: hoursAgo(22), now: NOW })).toBe(CONVERSATION_WINDOW.CRITICAL)
    expect(windowOf({ lastInboundAt: hoursAgo(30), now: NOW })).toBe(CONVERSATION_WINDOW.EXPIRED)
  })

  // As fronteiras são exatamente onde o erro custa caro: 24h em ponto já é recusa da Meta.
  it('trata as fronteiras como início da faixa seguinte', () => {
    expect(windowOf({ lastInboundAt: hoursAgo(12), now: NOW })).toBe(CONVERSATION_WINDOW.WARNING)
    expect(windowOf({ lastInboundAt: hoursAgo(21), now: NOW })).toBe(CONVERSATION_WINDOW.CRITICAL)
    expect(windowOf({ lastInboundAt: hoursAgo(24), now: NOW })).toBe(CONVERSATION_WINDOW.EXPIRED)
  })

  // Sem inbound não há janela aberta; classificar como expirada evita prometer texto livre.
  it('considera expirada quando o cliente nunca escreveu', () => {
    expect(windowOf({ lastInboundAt: null, now: NOW })).toBe(CONVERSATION_WINDOW.EXPIRED)
  })

  // O defeito que isto tranca: aplicar a regra do WhatsApp ao chat de site bloquearia o composer
  // num canal onde nada expira.
  it('nunca expira em canal sem janela de sessão', () => {
    expect(windowOf({ lastInboundAt: hoursAgo(720), now: NOW, channel: CONVERSATION_CHANNEL.WEBCHAT })).toBe(
      CONVERSATION_WINDOW.FRESH,
    )
    expect(windowOf({ lastInboundAt: null, now: NOW, channel: CONVERSATION_CHANNEL.WEBCHAT })).toBe(
      CONVERSATION_WINDOW.FRESH,
    )
  })

  it('mantém a regra do WhatsApp quando o canal não é informado', () => {
    expect(windowOf({ lastInboundAt: hoursAgo(30), now: NOW })).toBe(
      windowOf({ lastInboundAt: hoursAgo(30), now: NOW, channel: CONVERSATION_CHANNEL.WHATSAPP }),
    )
  })
})

describe('formatContactHandle', () => {
  it('formata telefone no WhatsApp e arroba nas redes', () => {
    expect(formatContactHandle({ handle: '5511988887777', channel: CONVERSATION_CHANNEL.WHATSAPP })).toBe(
      '+55 (11) 98888-7777',
    )
    expect(formatContactHandle({ handle: 'marina.alves', channel: CONVERSATION_CHANNEL.INSTAGRAM })).toBe(
      '@marina.alves',
    )
    expect(formatContactHandle({ handle: '@ja.tem', channel: CONVERSATION_CHANNEL.INSTAGRAM })).toBe('@ja.tem')
  })

  it('encurta a sessão anônima do chat de site', () => {
    expect(formatContactHandle({ handle: 'sess_9f2a7c41b8', channel: CONVERSATION_CHANNEL.WEBCHAT })).toBe(
      'Visitante 7c41b8',
    )
  })

  // Bandeira em @perfil não significaria nada: o identificador não carrega país.
  it('só devolve bandeira quando o identificador é telefone', () => {
    expect(contactFlag({ handle: '5511988887777' })).toBe('🇧🇷')
    expect(contactFlag({ handle: 'marina.alves', channel: CONVERSATION_CHANNEL.INSTAGRAM })).toBe('')
  })
})

describe('formatStalledFor', () => {
  it('formata dias, horas e minutos', () => {
    expect(formatStalledFor(hoursAgo(5 * 24 + 6.2), NOW)).toBe('5d 6h:12m')
    expect(formatStalledFor(hoursAgo(3.5), NOW)).toBe('3h:30m')
    expect(formatStalledFor(hoursAgo(0.25), NOW)).toBe('15m')
  })

  it('não devolve tempo negativo para carimbo no futuro', () => {
    expect(formatStalledFor(new Date(NOW + HOUR).toISOString(), NOW)).toBe('0m')
  })
})
