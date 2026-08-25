import { describe, expect, it } from 'bun:test'

import { HTML_TOKEN, tokenizeHtml } from './htmlHighlight.util'

function rebuild(source: string): string {
  return tokenizeHtml(source)
    .map((token) => token.text)
    .join('')
}

function kindsOf(source: string): readonly string[] {
  return [...new Set(tokenizeHtml(source).map((token) => token.kind))]
}

describe('tokenizeHtml', () => {
  /**
   * A propriedade que importa mais que qualquer cor: concatenar os tokens devolve a entrada, byte
   * a byte. Um realce que perde caractere esconde do autor um texto que o destinatario vai receber.
   */
  it.each([
    '<p style="color:#fff">Ola {{nome}}</p>',
    '<!doctype html><html lang="pt-BR"><body>x</body></html>',
    '<!-- comentario com <tag> dentro --> texto solto',
    'texto sem marcacao nenhuma',
    '<img src="https://x/a.png" alt="a" />',
    '<td colspan=2 >x',
    '',
    '< nao e tag',
    "<a href='aspas simples'>x</a>",
    '<p>quebra\n\nde linha</p>',
  ])('nao perde nem inventa caractere: %j', (source) => {
    expect(rebuild(source)).toBe(source)
  })

  it('separa tag, nome, atributo e valor', () => {
    expect(kindsOf('<a href="https://x">i</a>')).toEqual([
      HTML_TOKEN.TAG,
      HTML_TOKEN.NAME,
      HTML_TOKEN.TEXT,
      HTML_TOKEN.ATTRIBUTE,
      HTML_TOKEN.VALUE,
    ])
  })

  it('marca a variavel do template, dentro ou fora de tag', () => {
    expect(kindsOf('{{resetUrl}}')).toContain(HTML_TOKEN.VARIABLE)
    expect(kindsOf('<p>{{ nome }}</p>')).toContain(HTML_TOKEN.VARIABLE)
  })

  it('comentario nao vira tag, mesmo com marcacao dentro', () => {
    expect(kindsOf('<!-- <script>x</script> -->')).toEqual([HTML_TOKEN.COMMENT])
  })

  it('nao devolve token vazio, que viraria <span> inutil no DOM', () => {
    const tokens = tokenizeHtml('<p class="a">x</p>')

    expect(tokens.every((token) => token.text.length > 0)).toBe(true)
  })
})
