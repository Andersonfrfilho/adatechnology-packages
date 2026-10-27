import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { TemplatePreview } from './TemplatePreview'

const LABELS = {
  to: 'para', now: 'agora', mailbox: 'Caixa', time: '09:41', address: 'a@b.c', counter: '1 de 1',
  folder: 'Entrada', senderAddress: 'no-reply@ada', unsubscribe: 'cancelar', online: 'online',
  today: 'hoje', compose: 'escrever', reply: 'responder', forward: 'encaminhar', replyAll: 'todos',
}

const RENDERED = {
  title: 'Aviso',
  body: 'Texto de exemplo',
  constraints: [],
} as never

function render(emailHtml?: string): string {
  return renderToStaticMarkup(
    <TemplatePreview
      channel="email"
      viewport="browser"
      rendered={RENDERED}
      labels={LABELS}
      {...(emailHtml ? { emailHtml } : {})}
    />,
  )
}

describe('corpo do preview de e-mail', () => {
  /** A queixa que originou isto: o preview mostrava a moldura do painel, nao o campo. */
  it('mostra o HTML DO CAMPO, e nao outro conteudo', () => {
    const markup = render('<h1>Meu titulo</h1><p>Meu texto</p>')

    expect(markup).toContain('srcDoc="&lt;h1&gt;Meu titulo&lt;/h1&gt;&lt;p&gt;Meu texto&lt;/p&gt;"')
    expect(markup).not.toContain('Ada Technology')
  })

  it('sem HTML no campo, o corpo continua texto — nenhum iframe aparece', () => {
    const markup = render()

    expect(markup).not.toContain('<iframe')
    expect(markup).toContain('Texto de exemplo')
  })

  it('o iframe e o mais restrito possivel: sandbox vazio', () => {
    expect(render('<p>x</p>')).toContain('sandbox=""')
  })
})
