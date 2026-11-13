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

describe('anexo na moldura do canal', () => {
  const ATTACHMENT = { name: 'boleto-nf-899853.pdf', detail: '4,4 KB · PDF' }

  function renderChannel(channel: string, viewport: string, attachment?: typeof ATTACHMENT): string {
    return renderToStaticMarkup(
      <TemplatePreview
        channel={channel}
        viewport={viewport}
        rendered={RENDERED}
        labels={LABELS}
        {...(attachment ? { attachment } : {})}
      />,
    )
  }

  it('WhatsApp mostra o cartão do documento dentro do balão', () => {
    const markup = renderChannel('whatsapp', 'ios', ATTACHMENT)

    expect(markup).toContain('adn-preview-attachment--wa')
    expect(markup).toContain('boleto-nf-899853.pdf')
    expect(markup).toContain('4,4 KB · PDF')
  })

  it('e-mail mostra o anexo no desktop e no celular', () => {
    expect(renderChannel('email', 'browser', ATTACHMENT)).toContain('adn-preview-attachment--mail')
    expect(renderChannel('email', 'ios', ATTACHMENT)).toContain('boleto-nf-899853.pdf')
  })

  it('sem anexo, nada muda', () => {
    expect(renderChannel('whatsapp', 'ios')).not.toContain('adn-preview-attachment')
    expect(renderChannel('email', 'browser')).not.toContain('adn-preview-attachment')
  })
})
