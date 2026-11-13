import { describe, expect, it } from 'bun:test'

import { summarizeTemplateBody, TEMPLATE_PAGE_SIZES } from './templateList.constant'

describe('summarizeTemplateBody', () => {
  it('tira a marcação e o estilo do e-mail e mantém só o texto', () => {
    const html =
      '<html><head><style>p{color:red}</style></head><body><!-- x --><p>Olá&nbsp;<b>Ana</b></p></body></html>'
    expect(summarizeTemplateBody(html)).toBe('Olá Ana')
  })

  it('corta o texto longo com reticências', () => {
    const out = summarizeTemplateBody('a'.repeat(500), 50)
    expect(out.length).toBe(50)
    expect(out.endsWith('…')).toBe(true)
  })

  it('deixa texto curto intacto', () => {
    expect(summarizeTemplateBody('Nova mensagem de {{nome}}')).toBe('Nova mensagem de {{nome}}')
  })
})

describe('tamanhos de página', () => {
  it('oferece o padrão de 25', () => {
    expect(TEMPLATE_PAGE_SIZES).toContain(25)
  })
})
