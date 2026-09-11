import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { QuickRepliesWorkspace } from './QuickRepliesWorkspace'

describe('QuickRepliesWorkspace', () => {
  it('sem createQuickReply, fica só leitura — sem "nova mensagem" e sem coluna de ações', () => {
    const markup = renderToStaticMarkup(<QuickRepliesWorkspace api={{}} />)

    expect(markup).not.toContain('Nova mensagem')
    expect(markup).not.toContain('Ações')
    expect(markup).toContain('Você só pode consultar as mensagens prontas.')
  })

  it('com createQuickReply, mostra o botão de criar e a coluna de ações', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesWorkspace
        api={{ createQuickReply: async () => ({ id: '1', title: 'T', shortcut: 't', body: 'B' }) }}
      />,
    )

    expect(markup).toContain('Nova mensagem')
    expect(markup).not.toContain('Você só pode consultar as mensagens prontas.')
  })

  it('deixa o host trocar o título sem mexer no resto dos textos', () => {
    const markup = renderToStaticMarkup(<QuickRepliesWorkspace api={{}} labels={{ title: 'Respostas rápidas' }} />)

    expect(markup).toContain('Respostas rápidas')
    expect(markup).toContain('Buscar por título, atalho ou texto')
  })
})
