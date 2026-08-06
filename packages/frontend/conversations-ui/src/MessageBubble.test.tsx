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
