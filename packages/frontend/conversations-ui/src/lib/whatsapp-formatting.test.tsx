import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { parseWhatsAppFormatting } from './whatsapp-formatting'

function render(text: string): string {
  return renderToStaticMarkup(<>{parseWhatsAppFormatting(text)}</>)
}

describe('parseWhatsAppFormatting com marcador sem par', () => {
  // Estes casos travavam a aba: o laço reprocessava a mesma string sem consumir o marcador.
  it('trata o sublinhado solto de um nome de arquivo como texto', () => {
    expect(render('IMG_2026.jpg')).toBe('<span>IMG</span><span>_</span><span>2026.jpg</span>')
  })

  it('não trava com asterisco, til ou crase sem fechamento', () => {
    expect(render('3 * 4')).toContain('*')
    expect(render('mais ou menos ~10')).toContain('~')
    expect(render('use ` para código')).toContain('`')
  })

  it('sobrevive a uma linha só de marcadores', () => {
    expect(render('*_~`')).toBe('<span>*</span><span>_</span><span>~</span><span>`</span>')
  })
})

describe('parseWhatsAppFormatting com marcador fechado', () => {
  it('continua formatando o par completo depois do marcador solto', () => {
    expect(render('IMG_2026 *urgente*')).toContain('<strong>urgente</strong>')
  })

  it('mantém negrito, itálico e tachado', () => {
    expect(render('*a* _b_ ~c~')).toBe('<strong>a</strong><span> </span><em>b</em><span> </span><del>c</del>')
  })
})

describe('parseWhatsAppFormatting com quebras de linha', () => {
  it('preserva quebra simples e linha em branco no texto sem bloco', () => {
    expect(render('a\nb')).toBe('<span>a\nb</span>')
    expect(render('a\n\nb')).toBe('<span>a\n\nb</span>')
  })

  it('não deixa o marcador atravessar a quebra de linha', () => {
    expect(render('*a\nb*')).not.toContain('<strong>')
    expect(render('_a\nb_')).not.toContain('<em>')
    expect(render('~a\nb~')).not.toContain('<del>')
    expect(render('`a\nb`')).not.toContain('<code')
  })

  it('continua formatando em cada linha', () => {
    expect(render('*a*\n_b_')).toBe('<strong>a</strong><span>\n</span><em>b</em>')
  })
})

describe('parseWhatsAppFormatting com blocos por linha', () => {
  it('lista com * e - vira ul, com inline dentro', () => {
    const markup = render('* *um*\n- dois')
    expect(markup).toMatch(/^<ul[^>]*><li><strong>um<\/strong><\/li><li><span>dois<\/span><\/li><\/ul>$/)
  })

  it('lista numerada mantém o número digitado', () => {
    const markup = render('1. a\n3. b')
    expect(markup).toMatch(/^<ol[^>]*><li value="1"><span>a<\/span><\/li><li value="3"><span>b<\/span><\/li><\/ol>$/)
  })

  it('citação vira blockquote, uma linha por div', () => {
    expect(render('> oi\n> _tchau_')).toMatch(
      /^<blockquote[^>]*><div><span>oi<\/span><\/div><div><em>tchau<\/em><\/div><\/blockquote>$/,
    )
  })

  it('preserva texto e linhas em branco em volta dos blocos', () => {
    const markup = render('Olá\n\n- a\n\nTchau')
    expect(markup).toBe(
      '<div><span>Olá\n</span>\n</div><ul class="list-disc pl-5"><li><span>a</span></li></ul><div><span>\nTchau</span></div>',
    )
  })

  it('asterisco sem espaço no início é negrito, não lista', () => {
    expect(render('*oi*')).toBe('<strong>oi</strong>')
  })

  it('com bloco de código de várias linhas, fica só no inline', () => {
    expect(render('- a\n```x\ny```')).not.toContain('<ul')
  })
})

describe('parseWhatsAppFormatting — paridade com o WhatsApp em prosa', () => {
  it('linha "- Oi" vira lista e "> x" vira citação, como no aparelho', () => {
    expect(render('- Oi')).toContain('<ul')
    expect(render('> x')).toContain('<blockquote')
  })

  it('texto, linha em branco, lista, linha em branco, texto mantém as duas linhas em branco', () => {
    const markup = render('a\n\n- b\n\nc')
    expect(markup).toBe(
      '<div><span>a\n</span>\n</div><ul class="list-disc pl-5"><li><span>b</span></li></ul><div><span>\nc</span></div>',
    )
  })
})
