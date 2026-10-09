import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageBubble } from './MessageBubble'
import type { MessagePayload } from './types'

const IMAGE_MESSAGE: MessagePayload = {
  id: 'msg-1',
  type: 'image',
  direction: 'outbound',
  sender: 'agent',
  timestamp: '2026-08-05T12:00:00.000Z',
  filename: 'planta-baixa.png',
  mediaUrl: 'https://cdn.test/planta-baixa.png',
}

describe('MessageBubble com mídia', () => {
  it('mostra a legenda que veio no conteúdo do envio', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble message={{ ...IMAGE_MESSAGE, content: 'Planta do 302' }} isMine />,
    )

    expect(markup).toContain('Planta do 302')
  })

  it('mostra a legenda que o cliente mandou junto da imagem', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble message={{ ...IMAGE_MESSAGE, direction: 'inbound', sender: 'customer', caption: 'É esse?' }} isMine={false} />,
    )

    expect(markup).toContain('É esse?')
  })

  it('não repete o nome do arquivo como se fosse legenda', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble message={{ ...IMAGE_MESSAGE, content: 'planta-baixa.png' }} isMine />,
    )

    expect(markup).not.toContain('>planta-baixa.png<')
  })
})

// D4, CA04: o e-mail não confirma leitura — o selo de lida não pode aparecer, nem por engano se o
// backend mandar `status: 'read'` por algum caminho antigo. A tela nunca finge o que o canal não sabe.
describe('MessageBubble e o selo de lida por canal (D4, CA04)', () => {
  const TEXT_MESSAGE: MessagePayload = {
    id: 'msg-2',
    type: 'text',
    direction: 'outbound',
    sender: 'agent',
    timestamp: '2026-08-05T12:00:00.000Z',
    content: 'Já enviamos a nota',
    status: 'read',
  }

  it('email não confirma leitura — o selo de lida não aparece mesmo com status "read"', () => {
    const markup = renderToStaticMarkup(<MessageBubble message={TEXT_MESSAGE} isMine channel="email" />)

    expect(markup).not.toContain('cv-status-ticks--read')
  })

  it('whatsapp confirma leitura — o selo de lida aparece normalmente', () => {
    const markup = renderToStaticMarkup(<MessageBubble message={TEXT_MESSAGE} isMine channel="whatsapp" />)

    expect(markup).toContain('cv-status-ticks--read')
  })

  it('sem channel, o padrão continua sendo whatsapp — comportamento de antes desta mudança', () => {
    const withChannel = renderToStaticMarkup(<MessageBubble message={TEXT_MESSAGE} isMine channel="whatsapp" />)
    const withoutChannel = renderToStaticMarkup(<MessageBubble message={TEXT_MESSAGE} isMine />)

    expect(withoutChannel).toEqual(withChannel)
  })
})
