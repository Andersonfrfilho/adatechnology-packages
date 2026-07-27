import { describe, expect, it } from 'bun:test'
import { CONVERSATION_CHANNEL, CHANNEL_FILTER_ALL, channelFiltersFor } from './conversationChannel'

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
