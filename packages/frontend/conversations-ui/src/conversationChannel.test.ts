import { describe, expect, it } from 'bun:test'
import { CONVERSATION_CHANNEL as CORE_CONVERSATION_CHANNEL } from '@adatechnology/conversation-contracts'

import {
  CHANNEL_CAPABILITIES,
  CHANNEL_FILTER_ALL,
  CONVERSATION_CHANNEL,
  HANDLE_KIND,
  REOPEN_MECHANISM,
  channelFiltersFor,
  type ConversationChannel,
} from './conversationChannel'

describe('channelFiltersFor', () => {
  // O ponto do helper: a barra oferece só o que existe. Oferecer Instagram numa conta que só tem
  // WhatsApp promete um recorte que nunca traz resultado.
  it('lista apenas os canais presentes, com Todos na frente', () => {
    const options = channelFiltersFor([
      { channel: CONVERSATION_CHANNEL.WHATSAPP },
      { channel: CONVERSATION_CHANNEL.INSTAGRAM },
      { channel: CONVERSATION_CHANNEL.WHATSAPP },
    ])

    expect(options.map((option) => option.value)).toEqual([
      CHANNEL_FILTER_ALL,
      CONVERSATION_CHANNEL.WHATSAPP,
      CONVERSATION_CHANNEL.INSTAGRAM,
    ])
  })

  it('não oferece filtro quando há um canal só', () => {
    expect(channelFiltersFor([{ channel: CONVERSATION_CHANNEL.WHATSAPP }, {}])).toEqual([])
  })

  it('não oferece filtro para lista vazia', () => {
    expect(channelFiltersFor([])).toEqual([])
  })

  // Conversa sem canal é WhatsApp por compatibilidade — não pode virar uma quinta opção fantasma.
  it('trata ausência de canal como whatsapp', () => {
    const options = channelFiltersFor([{}, { channel: CONVERSATION_CHANNEL.WEBCHAT }])

    expect(options.map((option) => option.value)).toEqual([
      CHANNEL_FILTER_ALL,
      CONVERSATION_CHANNEL.WHATSAPP,
      CONVERSATION_CHANNEL.WEBCHAT,
    ])
  })

  // Ordem do catálogo: se dependesse da ordem de chegada, a barra se reorganizaria a cada refetch.
  it('mantém ordem estável independente da ordem da lista', () => {
    const first = channelFiltersFor([
      { channel: CONVERSATION_CHANNEL.WEBCHAT },
      { channel: CONVERSATION_CHANNEL.WHATSAPP },
    ])
    const second = channelFiltersFor([
      { channel: CONVERSATION_CHANNEL.WHATSAPP },
      { channel: CONVERSATION_CHANNEL.WEBCHAT },
    ])

    expect(first).toEqual(second)
  })
})

describe('canais do contrato exibidos pela UI', () => {
  // Canal novo no contrato sem entrada aqui reprova no tsc (Record completo); este teste cobre o
  // mesmo ponto em runtime, para o caso de o vocabulário ser alterado sem recompilar a UI.
  it('todo canal do contrato tem entrada de exibição', () => {
    for (const channel of CORE_CONVERSATION_CHANNEL) {
      expect(CHANNEL_CAPABILITIES[channel as ConversationChannel]).toBeDefined()
    }
  })

  it('app e portal existem como canais, com rótulo e sem reabertura por template ou tag', () => {
    expect(CONVERSATION_CHANNEL.APP).toBe('app')
    expect(CONVERSATION_CHANNEL.PORTAL).toBe('portal')
    expect(CHANNEL_CAPABILITIES.app.reopenMechanism).toBe(REOPEN_MECHANISM.NONE)
    expect(CHANNEL_CAPABILITIES.portal.reopenMechanism).toBe(REOPEN_MECHANISM.NONE)
    expect(CHANNEL_CAPABILITIES.app.handleKind).toBe(HANDLE_KIND.SESSION)
    expect(CHANNEL_CAPABILITIES.portal.handleKind).toBe(HANDLE_KIND.SESSION)
  })
})
