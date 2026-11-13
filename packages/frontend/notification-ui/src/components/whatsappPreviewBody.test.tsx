import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { TemplatePreview } from './TemplatePreview'

const LABELS = {
  to: 'para', now: 'agora', mailbox: 'Caixa', time: '09:41', address: 'a@b.c', counter: '1 de 1',
  folder: 'Entrada', senderAddress: 'no-reply@ada', unsubscribe: 'cancelar', online: 'online',
  today: 'hoje', compose: 'escrever', reply: 'responder', forward: 'encaminhar', replyAll: 'todos',
}

function render(body: string): string {
  return renderToStaticMarkup(
    <TemplatePreview
      channel="whatsapp"
      viewport="android"
      rendered={{ title: '', body, constraints: [] } as never}
      labels={LABELS}
    />,
  )
}

describe('corpo do preview de WhatsApp', () => {
  // O balão mostrava `*negrito*` com os asteriscos: o app formata, e o preview precisa mostrar o
  // mesmo. A marcação vem do `parseWhatsAppFormatting` do conversations-ui, a mesma das conversas.
  it('formata negrito, itálico e tachado em vez de mostrar os marcadores', () => {
    const html = render('*Boleto* _novo_ ~antigo~')
    expect(html).toContain('<strong>Boleto</strong>')
    expect(html).toContain('<em>novo</em>')
    expect(html).toContain('<del>antigo</del>')
    expect(html).not.toContain('*Boleto*')
  })

  it('desenha lista e citação', () => {
    const html = render('Itens:\n- *Valor*\n> obrigado')
    expect(html).toContain('<li><strong>Valor</strong></li>')
    expect(html).toContain('<blockquote')
  })

  it('HTML no corpo continua texto', () => {
    expect(render('<b>x</b>')).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
