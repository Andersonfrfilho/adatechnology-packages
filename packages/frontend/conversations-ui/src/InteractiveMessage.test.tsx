import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { InteractiveMessage } from './InteractiveMessage'
import type { InteractivePayload } from './types'

function render(payload: InteractivePayload): string {
  return renderToStaticMarkup(<InteractiveMessage payload={payload} />)
}

describe('InteractiveMessage', () => {
  it('formata negrito no corpo, como o aparelho faz', () => {
    const markup = render({ type: 'button', body: { text: 'Qual o *prazo desejado*?' } })

    expect(markup).toContain('<strong>prazo desejado</strong>')
    expect(markup).not.toContain('*prazo desejado*')
  })

  it('formata cabeçalho e rodapé também', () => {
    const markup = render({
      type: 'list',
      header: { text: '*Menu*' },
      body: { text: 'corpo' },
      footer: { text: '_Selecione_' },
    })

    expect(markup).toContain('<strong>Menu</strong>')
    expect(markup).toContain('<em>Selecione</em>')
  })

  it('deixa título de opção literal, porque o WhatsApp não formata ali', () => {
    const markup = render({
      type: 'button',
      body: { text: 'corpo' },
      action: { buttons: [{ reply: { id: 'sim', title: '*Sim*' } }] },
    })

    expect(markup).toContain('*Sim*')
    expect(markup).not.toContain('<strong>Sim</strong>')
  })
})
