/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parseMarkdown } from './parseMarkdown'
import { renderMarkdownToHtml } from './renderHtml'

const render = (markdown: string): string => renderMarkdownToHtml(markdown, { headingIds: false })

describe('renderMarkdownToHtml — segurança (XSS)', () => {
  const attacks: readonly [string, string][] = [
    ['tag script', '<script>alert(1)</script>'],
    ['img com onerror', '<img src=x onerror=alert(1)>'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['svg com onload', '<svg onload=alert(1)>'],
    ['bloco HTML entre parágrafos', 'texto\n\n<div onclick="x()">clique</div>\n\nfim'],
  ]

  for (const [name, attack] of attacks) {
    it(`escapa ${name} — nenhuma tag do autor chega à saída`, () => {
      const html = render(attack)
      expect(html).not.toMatch(/<(script|img|iframe|svg|div)\b/i)
      expect(html).toContain('&lt;')
    })
  }

  const unsafeLinks = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    ' javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
  ]

  for (const destination of unsafeLinks) {
    it(`recusa link ${JSON.stringify(destination)} e mantém só o texto`, () => {
      const html = render(`[clique](<${destination}>)`)
      expect(html).not.toContain('<a')
      expect(html.toLowerCase()).not.toContain('javascript:')
      expect(html).toContain('clique')
    })
  }

  it('recusa imagem por data: (SVG com script) e mostra o alt', () => {
    const html = render('![logo](data:image/svg+xml;base64,PHN2Zz4=)')
    expect(html).not.toContain('<img')
    expect(html).toContain('logo')
  })

  it('recusa imagem por javascript:', () => {
    expect(render('![x](javascript:alert(1))')).not.toContain('<img')
  })

  it('escapa aspas no destino — não há como fechar o atributo href', () => {
    const html = render('[a](https://example.com/"onmouseover="alert(1))')
    expect(html).not.toMatch(/href="[^"]*"onmouseover/)
    expect(html).toContain('&quot;')
  })

  it('escapa aspas no título do link e no alt da imagem', () => {
    const html = render('[a](https://example.com "x\\" onclick=\\"y") ![b" onerror="z](https://example.com/i.png)')
    // O texto pode conter a palavra; o que não pode é virar atributo (aspas cruas depois do `=`).
    expect(html).not.toMatch(/onclick="/)
    expect(html).not.toMatch(/onerror="/)
  })

  it('escapa HTML dentro de código e de bloco de código', () => {
    expect(render('`<b>x</b>`')).toBe('<p><code>&lt;b&gt;x&lt;/b&gt;</code></p>')
    expect(render('```html\n<script>x</script>\n```')).toBe(
      '<pre><code class="language-html">&lt;script&gt;x&lt;/script&gt;</code></pre>',
    )
  })

  it('linguagem do bloco de código não injeta atributo', () => {
    const html = render('```js"onclick="x\ncode\n```')
    expect(html).toMatch(/^<pre><code class="language-[a-z0-9+#-]*">code<\/code><\/pre>$/)
  })

  it('link permitido sai com rel="noopener noreferrer" e nova aba quando externo', () => {
    expect(render('[site](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a></p>',
    )
    expect(render('[sobre](/sobre)')).toBe('<p><a href="/sobre" rel="noopener noreferrer">sobre</a></p>')
  })

  it('aceita mailto e tel', () => {
    expect(render('[mail](mailto:contato@example.com)')).toContain('href="mailto:contato@example.com"')
    expect(render('[tel](tel:+5511999999999)')).toContain('href="tel:+5511999999999"')
  })

  it('não explode com entrada patológica (delimitadores sem par)', () => {
    const started = performance.now()
    render('*a '.repeat(20_000) + '['.repeat(20_000) + '`'.repeat(5_000))
    expect(performance.now() - started).toBeLessThan(2_000)
  })

  it('limita o aninhamento de citação', () => {
    expect(() => parseMarkdown('>'.repeat(5_000) + ' fundo')).not.toThrow()
  })
})

describe('renderMarkdownToHtml — formatação', () => {
  it('títulos, com deslocamento de nível e âncora', () => {
    expect(renderMarkdownToHtml('# Olá Mundo', { headingLevelOffset: 1 })).toBe('<h2 id="ola-mundo">Olá Mundo</h2>')
    expect(render('###### fim')).toBe('<h6>fim</h6>')
    expect(render('#hashtag')).toBe('<p>#hashtag</p>')
  })

  it('âncoras repetidas ganham sufixo', () => {
    expect(renderMarkdownToHtml('## A\n\n## A')).toBe('<h2 id="a">A</h2>\n<h2 id="a-2">A</h2>')
  })

  it('ênfase, negrito, tachado e snake_case intocado', () => {
    expect(render('*a* **b** _c_ __d__ ~~e~~ snake_case_name')).toBe(
      '<p><em>a</em> <strong>b</strong> <em>c</em> <strong>d</strong> <del>e</del> snake_case_name</p>',
    )
    expect(render('**negrito com *itálico* dentro**')).toBe(
      '<p><strong>negrito com <em>itálico</em> dentro</strong></p>',
    )
  })

  it('listas simples, ordenadas e aninhadas', () => {
    expect(render('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(render('3. três\n4. quatro')).toBe('<ol start="3"><li>três</li><li>quatro</li></ol>')
    expect(render('- a\n  - a1\n- b')).toBe('<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>')
  })

  it('lista solta usa parágrafos', () => {
    expect(render('- a\n\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>')
  })

  it('citação, separador e quebra de linha', () => {
    expect(render('> citado\n> ainda')).toBe('<blockquote><p>citado ainda</p></blockquote>')
    expect(render('---')).toBe('<hr>')
    expect(render('linha  \nnova')).toBe('<p>linha<br>nova</p>')
  })

  it('imagem segura com lazy loading', () => {
    expect(render('![capa](https://example.com/a.png "Título")')).toBe(
      '<p><img src="https://example.com/a.png" alt="capa" title="Título" loading="lazy" decoding="async"></p>',
    )
  })

  it('escape com barra invertida', () => {
    expect(render('\\*não itálico\\*')).toBe('<p>*não itálico*</p>')
  })

  it('autolink', () => {
    expect(render('<https://example.com>')).toContain('<a href="https://example.com"')
  })
})
