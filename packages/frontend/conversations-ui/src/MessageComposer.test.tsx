import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageComposer, DEFAULT_MESSAGE_COMPOSER_LABELS } from './MessageComposer'

describe('MessageComposer', () => {
  it('mostra a ação ociosa no lugar do enviar quando não há nada para enviar', () => {
    const markup = renderToStaticMarkup(
      <MessageComposer onSend={() => {}} idleAction={<button aria-label="Gravar áudio" />} />,
    )

    expect(markup).toContain('aria-label="Gravar áudio"')
    expect(markup).not.toContain('aria-label="Enviar"')
  })

  it('mantém o botão de enviar quando não há ação ociosa', () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={() => {}} />)

    expect(markup).toContain('aria-label="Enviar"')
  })

  it('mostra o enviar assim que há texto, mesmo com ação ociosa configurada', () => {
    const markup = renderToStaticMarkup(
      <MessageComposer
        onSend={() => {}}
        value="oi"
        onChange={() => {}}
        idleAction={<button aria-label="Gravar áudio" />}
      />,
    )

    expect(markup).toContain('aria-label="Enviar"')
    expect(markup).not.toContain('aria-label="Gravar áudio"')
  })

  it('sem savedQuickReplies, não desenha o botão de raio nem o combobox', () => {
    const withPort = renderToStaticMarkup(
      <MessageComposer
        onSend={() => {}}
        savedQuickReplies={{ listQuickReplies: async () => [], conversationId: 'c1' }}
      />,
    )
    const withoutPort = renderToStaticMarkup(<MessageComposer onSend={() => {}} />)

    expect(withPort).toContain('aria-label="Mensagens prontas"')
    expect(withoutPort).not.toContain('aria-label="Mensagens prontas"')
    expect(withoutPort).not.toContain('role="combobox"')
  })
})

// RF10, D3: recurso que o canal não tem aparece desabilitado com dica legível por leitor de tela —
// nunca escondido sem explicação, e nunca só com `title` (inacessível a leitor de tela).
describe('MessageComposer e a capacidade do canal (RF10, D3)', () => {
  it('webchat não grava áudio — o microfone vem desabilitado com dica em aria-describedby', () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={() => {}} onAttach={() => {}} channel="webchat" />)

    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain(DEFAULT_MESSAGE_COMPOSER_LABELS.audioDisabledHint)
  })

  it('whatsapp grava áudio — o microfone continua habilitado, sem a dica de bloqueio', () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={() => {}} onAttach={() => {}} channel="whatsapp" />)

    expect(markup).not.toContain(DEFAULT_MESSAGE_COMPOSER_LABELS.audioDisabledHint)
  })

  it('todo canal atual aceita anexo e resposta rápida — os dois continuam habilitados', () => {
    const markup = renderToStaticMarkup(
      <MessageComposer
        onSend={() => {}}
        onAttach={() => {}}
        channel="email"
        savedQuickReplies={{ listQuickReplies: async () => [], conversationId: 'c1' }}
      />,
    )

    expect(markup).not.toContain(DEFAULT_MESSAGE_COMPOSER_LABELS.attachDisabledHint)
    expect(markup).not.toContain(DEFAULT_MESSAGE_COMPOSER_LABELS.quickRepliesDisabledHint)
  })

  it('sem channel, o padrão continua sendo whatsapp — nada muda para quem já usava o pacote', () => {
    const withChannel = renderToStaticMarkup(<MessageComposer onSend={() => {}} onAttach={() => {}} channel="whatsapp" />)
    const withoutChannel = renderToStaticMarkup(<MessageComposer onSend={() => {}} onAttach={() => {}} />)

    expect(withoutChannel).toEqual(withChannel)
  })
})
