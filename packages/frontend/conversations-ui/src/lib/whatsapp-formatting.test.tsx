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
    expect(render('*a* _b_ ~c~')).toBe(
      '<strong>a</strong><span> </span><em>b</em><span> </span><del>c</del>',
    )
  })
})
