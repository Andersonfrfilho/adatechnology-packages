import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { InteractiveMessage } from './InteractiveMessage'
import { LocationCard } from './LocationCard'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'

const markupOf = (text: string): string => renderToStaticMarkup(<div>{parseWhatsAppFormatting(text)}</div>)

describe('links e formatação no simulador', () => {
  it('torna clicável só http(s), sem levar a pontuação final', () => {
    const markup = markupOf('Veja https://exemplo.test/a?b=1. Tchau')
    expect(markup).toContain('<a href="https://exemplo.test/a?b=1"')
    expect(markup).toContain('rel="noopener noreferrer"')
    expect(markup).toContain('target="_blank"')
    expect(markupOf('javascript:alert(1) e ftp://x.test')).not.toContain('<a ')
  })

  it('formata negrito, itálico, tachado e monoespaçado', () => {
    const markup = markupOf('*a* _b_ ~c~ ```RES-123```')
    expect(markup).toContain('<strong>a</strong>')
    expect(markup).toContain('<em>b</em>')
    expect(markup).toContain('<del>c</del>')
    expect(markup).toContain('<code>RES-123</code>')
  })
})

describe('cta_url e localização', () => {
  it('desenha o botão do cta_url como link e recusa esquema que não é http(s)', () => {
    const ok = renderToStaticMarkup(
      <InteractiveMessage payload={{ type: 'cta_url', body: { text: 'Veja' }, action: { name: 'cta_url', parameters: { display_text: 'Ver fotos', url: 'https://exemplo.test/p' } } }} />,
    )
    expect(ok).toContain('href="https://exemplo.test/p"')
    expect(ok).toContain('Ver fotos')
    const bad = renderToStaticMarkup(
      <InteractiveMessage payload={{ type: 'cta_url', body: { text: 'Veja' }, action: { name: 'cta_url', parameters: { display_text: 'x', url: 'javascript:alert(1)' } } }} />,
    )
    expect(bad).not.toContain('href=')
  })

  it('desenha o cartão de localização com nome, endereço e link do mapa', () => {
    const markup = renderToStaticMarkup(<LocationCard location={{ latitude: -23.5, longitude: -46.6, name: 'Pousada', address: 'Rua 1' }} />)
    expect(markup).toContain('Pousada')
    expect(markup).toContain('Rua 1')
    expect(markup).toContain('https://www.google.com/maps?q=-23.5,-46.6')
  })
})
