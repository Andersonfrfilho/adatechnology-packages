import { describe, expect, it } from 'bun:test'
import {
  CONVERSATION_CHANNEL as CORE_CONVERSATION_CHANNEL,
  CHANNEL_CAPABILITIES as CORE_CHANNEL_CAPABILITIES,
} from '@adatechnology/conversation-contracts'

import { CONVERSATION_CHANNEL } from './conversationChannel'
import { channelCapabilityFor } from './channelCapability'

const UI_CHANNELS: readonly string[] = Object.values(CONVERSATION_CHANNEL)

describe('channelCapabilityFor', () => {
  // O ponto da spec 211 (RF10): "duas verdades sobre capacidade de canal" é o risco que o plano
  // registra. Para canal que o contrato conhece, a capacidade tem de ser exatamente o objeto do
  // contrato — nunca uma cópia redeclarada aqui, porque cópia diverge no dia em que só uma muda.
  it('para canal que o contrato conhece, devolve o objeto do contrato — nunca redeclarado', () => {
    for (const channel of CORE_CONVERSATION_CHANNEL) {
      if (!UI_CHANNELS.includes(channel)) continue

      expect(channelCapabilityFor(channel as never)).toBe(CORE_CHANNEL_CAPABILITIES[channel])
    }
  })

  // Messenger e Instagram são canais que a UI já servia antes do núcleo existir, e o contrato não
  // os conhece (RF1). Convivência decidida: eles caem no fallback documentado do WhatsApp, o outro
  // canal da Meta com a mesma janela de 24h — não ganham tabela própria.
  it('canal que o contrato não conhece cai no fallback documentado, não numa tabela própria', () => {
    expect(channelCapabilityFor(CONVERSATION_CHANNEL.MESSENGER)).toBe(CORE_CHANNEL_CAPABILITIES.whatsapp)
    expect(channelCapabilityFor(CONVERSATION_CHANNEL.INSTAGRAM)).toBe(CORE_CHANNEL_CAPABILITIES.whatsapp)
  })

  it('ausência de canal continua sendo whatsapp, como antes desta mudança', () => {
    expect(channelCapabilityFor(undefined)).toBe(CORE_CHANNEL_CAPABILITIES.whatsapp)
  })
})

// As duas linhas que a tela usa para não mentir (D3, D4) — fixadas contra o contrato para que uma
// mudança futura nele quebre este teste em vez de quebrar a tela em silêncio.
describe('linhas da capacidade que a tela não pode fingir', () => {
  it('email não confirma leitura — não existe pixel de rastreio aqui (D4)', () => {
    expect(CORE_CHANNEL_CAPABILITIES.email.confirmsRead).toBe(false)
  })

  it('portal ouve áudio e não grava — Permissions-Policy nega o microfone lá (ADR-0073 §2)', () => {
    expect(CORE_CHANNEL_CAPABILITIES.portal.audio).toEqual({ plays: true, records: false })
  })
})
