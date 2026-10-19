/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Regras genéricas de e-mail HTML (spec 274 T1.1). As tabelas de caso são as da spec 272 do TransportAdA,
 * copiadas por valor SEM editar caso: a API e o painel passam a delegar a estas funções e precisam dar
 * exatamente os mesmos resultados.
 */

import { describe, expect, it } from 'bun:test'

import {
  STANDARD_EMAIL_THEME,
  buildInitials,
  escapeEmailHtml,
  findUnsafeEmailHtml,
  htmlToPlainText,
  interpolateEmailHtml,
  renderEmailLogoHtml,
  renderEmailMarksHtml,
} from './emailHtml'
import type { UnsafeEmailHtmlRule } from './emailHtml'

export type UnsafeEmailHtmlCase = {
  readonly html: string
  readonly name: string
  /** As regras que a API aplica; vazio é HTML seguro. */
  readonly rules: readonly UnsafeEmailHtmlRule[]
  /** O filtro grosso do worker: `bloqueia` ou `deixa para a API` (nunca mais estrito que a API). */
  readonly worker: 'bloqueia' | 'deixa para a API'
}

export const UNSAFE_EMAIL_HTML_CASES: readonly UnsafeEmailHtmlCase[] = [
  { html: '<script>alert(1)</script>', name: 'tag: script', rules: ['tag'], worker: 'bloqueia' },
  {
    html: '<SCRIPT SRC=x></SCRIPT>',
    name: 'tag: SCRIPT em maiúsculas',
    rules: ['tag'],
    worker: 'bloqueia',
  },
  {
    html: '<script\n>x</script>',
    name: 'tag: script com quebra de linha',
    rules: ['tag'],
    worker: 'bloqueia',
  },
  {
    html: '<iframe src="//example.test/"></iframe>',
    name: 'tag: iframe',
    rules: ['tag'],
    worker: 'bloqueia',
  },
  {
    html: '<form action="//example.test/"><input></form>',
    name: 'tag: form',
    rules: ['tag'],
    worker: 'bloqueia',
  },
  { html: '<object data="x"></object>', name: 'tag: object', rules: ['tag'], worker: 'bloqueia' },
  { html: '<embed src="x">', name: 'tag: embed', rules: ['tag'], worker: 'bloqueia' },
  {
    html: '<scripts>x</scripts>',
    name: 'tag: nome que só começa com script é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<formal>x</formal>',
    name: 'tag: nome que só começa com form é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="#" onclick="x()">a</a>',
    name: 'evento: onclick',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<img src=x onerror=alert(1)>',
    name: 'evento: onerror sem aspas',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<body ONLOAD = "x()">',
    name: 'evento: ONLOAD em maiúsculas com espaços',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<a/onclick=x>',
    name: 'evento: barra antes do nome',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<p title="a"onmouseover=x>',
    name: 'evento: logo após aspas',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<p>O cliente ficou online = sim</p>',
    name: 'evento: falso positivo em texto é aceito',
    rules: ['event'],
    worker: 'bloqueia',
  },
  {
    html: '<p>position=1, conta=3 e on=1</p>',
    name: 'evento: "on" no meio de palavra ou sem letras depois é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="javascript:alert(1)">a</a>',
    name: 'esquema: javascript:',
    rules: ['scheme'],
    worker: 'bloqueia',
  },
  {
    html: '<a href="JaVaScRiPt:alert(1)">a</a>',
    name: 'esquema: maiúsculas e minúsculas',
    rules: ['scheme'],
    worker: 'bloqueia',
  },
  {
    html: '<a href="vbscript:x">a</a>',
    name: 'esquema: vbscript:',
    rules: ['scheme'],
    worker: 'bloqueia',
  },
  {
    html: '<a href="java&#115;cript:alert(1)">a</a>',
    name: 'esquema: entidade decimal com ponto e vírgula',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="java&#115cript:alert(1)">a</a>',
    name: 'esquema: entidade decimal sem ponto e vírgula',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="java&#x73;cript:alert(1)">a</a>',
    name: 'esquema: entidade hexadecimal',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="javascript&colon;alert(1)">a</a>',
    name: 'esquema: &colon;',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="java&Tab;script:alert(1)">a</a>',
    name: 'esquema: &Tab; no meio',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="java&NewLine;script:alert(1)">a</a>',
    name: 'esquema: &NewLine; no meio',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="java\tscript:alert(1)">a</a>',
    name: 'esquema: tabulação no meio',
    rules: ['scheme'],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="  javascript:alert(1)">a</a>',
    name: 'esquema: espaços antes',
    rules: ['scheme'],
    worker: 'bloqueia',
  },
  {
    html: '<a href="/docs/javascript">a</a>',
    name: 'esquema: a palavra sem os dois pontos é segura',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<a href="{{contratante}}">a</a>',
    name: 'placeholder em tag: href',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<img src={{logoTransportadora}} alt="">',
    name: 'placeholder em tag: src sem aspas',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<p style="color:{{cor}}">a</p>',
    name: 'placeholder em tag: style',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<a title=">" href="{{contratante}}">a</a>',
    name: 'placeholder em tag: href depois de aspas com >',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: "<p title='>' style='{{cor}}'>a</p>",
    name: 'placeholder em tag: aspas simples com > antes',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<a title=">{{contratante}}">a</a>',
    name: 'placeholder em tag: dentro de valor entre aspas, depois de >',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<style>p{color:{{cor}}}</style>',
    name: 'placeholder em tag: dentro de style',
    rules: ['placeholder_in_tag'],
    worker: 'bloqueia',
  },
  {
    html: '<style type="text/css">p{color:red}</style><p>{{contratante}}</p>',
    name: 'placeholder depois de style é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<p title="a>b">{{contratante}}</p>',
    name: 'placeholder fora de tag com > em atributo é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: "<p>a > b e don't</p><p>{{contratante}}</p>",
    name: 'placeholder depois de > e aspas soltas no texto é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<p>{{contratante}}</p>',
    name: 'placeholder fora de tag é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<p>a</p><!-- mensagem -->{{numeroNota}}<!-- /mensagem -->',
    name: 'placeholder depois de comentário é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  {
    html: '<table style="width:620px"><tr><td style="color:#10222c">Olá {{contratante}}</td></tr></table>',
    name: 'HTML do modelo: tabela com estilo inline é seguro',
    rules: [],
    worker: 'deixa para a API',
  },
  { html: '', name: 'vazio é seguro', rules: [], worker: 'deixa para a API' },
]

describe('findUnsafeEmailHtml: tabela de casos da 272', () => {
  it('a tabela cobre as quatro regras, safe e unsafe, com a coluna worker', () => {
    const rules = new Set(UNSAFE_EMAIL_HTML_CASES.flatMap((row) => row.rules))

    expect([...rules].sort()).toEqual(['event', 'placeholder_in_tag', 'scheme', 'tag'])
    expect(UNSAFE_EMAIL_HTML_CASES.some((row) => row.rules.length === 0)).toBe(true)
    expect(UNSAFE_EMAIL_HTML_CASES.length).toBe(42)
  })

  for (const row of UNSAFE_EMAIL_HTML_CASES) {
    it(row.name, () => {
      expect([...findUnsafeEmailHtml(row.html)].sort()).toEqual([...row.rules].sort())
    })
  }

  it('casos fixados à mão, independentes da tabela', () => {
    expect(findUnsafeEmailHtml('<SCRIPT>x</SCRIPT>')).toEqual(['tag'])
    expect(findUnsafeEmailHtml('<a href="JaVa&#x73;cript&colon;x">')).toEqual(['scheme'])
    expect(findUnsafeEmailHtml('<a href="{{valor}}">')).toEqual(['placeholder_in_tag'])
    expect(findUnsafeEmailHtml('<p style="color:red">{{valor}}</p>')).toEqual([])
  })
})

describe('htmlToPlainText: casos da 272', () => {
  it('tira tags, preserva quebras de bloco e <br>', () => {
    const html = '<p>Olá <b>Alfa</b>,</p><div>Linha 1<br>Linha 2<br/>Linha 3</div><ul><li>a</li><li>b</li></ul>'

    expect(htmlToPlainText(html)).toBe('Olá Alfa,\nLinha 1\nLinha 2\nLinha 3\na\nb')
  })

  it('remove comentários (marcadores da área e condicionais), head, style e title', () => {
    const html = [
      '<html><head><title>T</title><style>p { color: red }</style></head><body>',
      '<!--[if mso]><table><tr><td>mso</td></tr></table><![endif]-->',
      '<!-- mensagem --><p>Texto</p><!-- /mensagem -->',
      '<STYLE type="text/css">x{}</STYLE></body></html>',
    ].join('')

    expect(htmlToPlainText(html)).toBe('Texto')
  })

  it('células viram espaço e linhas de tabela viram quebra', () => {
    const html =
      '<table><tr><td>001</td><td>Caixa</td><td>2 UN</td></tr><tr><td>002</td><td>Pallet</td><td>1 UN</td></tr></table>'

    expect(htmlToPlainText(html)).toBe('001 Caixa 2 UN\n002 Pallet 1 UN')
  })

  it('entidades numa passada só, com &amp; por último: &amp;lt; não vira <', () => {
    expect(htmlToPlainText('<p>&amp;lt; &lt;b&gt; &quot;a&quot; &#39;b&#39; &#x41; &#65; &amp;amp;</p>')).toBe(
      '&lt; <b> "a" \'b\' A A &amp;',
    )
  })

  it('valor escapado que parece tag não é tirado como tag', () => {
    expect(htmlToPlainText('<p>&lt;script&gt;x&lt;/script&gt;</p>')).toBe('<script>x</script>')
  })

  it('nbsp vira espaço e linhas em branco colapsam', () => {
    expect(htmlToPlainText('<p>a&nbsp;b</p><p></p><p></p><p>c</p>')).toBe('a b\n\nc')
  })

  it('&#0;, &#xD800;, &#57343; e acima de U+10FFFF somem', () => {
    expect(htmlToPlainText('<p>a&#0;b&#xD800;c&#57343;d&#x110000;e&#xD83D;f</p>')).toBe('abcdef')
  })

  it('código válido continua: &#x1F600; e &#65;', () => {
    expect(htmlToPlainText('<p>&#x1F600; &#65;</p>')).toBe('\u{1F600} A')
  })
})

describe('interpolateEmailHtml: casos da 272', () => {
  const NAMES = ['logoTransportadora', 'tabelaItens', 'marcasRodape', 'faixaResposta'] as const

  function render(template: string, values: Record<string, string> = {}, systemHtml: Record<string, string> = {}) {
    return interpolateEmailHtml({ systemHtml, systemHtmlNames: NAMES, template, values })
  }

  it('valor escapado, HTML do modelo intacto', () => {
    expect(render('<p style="color:#000">Olá {{ observacao }}!</p>', { observacao: '<b>x</b> & "y"' })).toBe(
      '<p style="color:#000">Olá &lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;!</p>',
    )
  })

  it('chave raw só pelo nome: o valor do sistema entra cru, o mesmo conteúdo em values sai escapado', () => {
    expect(
      render(
        '{{tabelaItens}}|{{observacao}}',
        { observacao: '<i>a</i>', tabelaItens: '<b>do usuario</b>' },
        { tabelaItens: '<table><tr><td>ok</td></tr></table>' },
      ),
    ).toBe('<table><tr><td>ok</td></tr></table>|&lt;i&gt;a&lt;/i&gt;')
  })

  it('chave de HTML do sistema sem valor do sistema sai vazia, mesmo com values', () => {
    expect(render('[{{logoTransportadora}}]', { logoTransportadora: '<img>' })).toBe('[]')
  })

  it('valor contendo {{logoTransportadora}} não é reinterpretado', () => {
    expect(
      render(
        '<p>{{observacao}}</p>{{logoTransportadora}}',
        { observacao: '{{logoTransportadora}} {{contratante}}', contratante: 'Alfa' },
        { logoTransportadora: '<img src="cid:company-logo">' },
      ),
    ).toBe('<p>{{logoTransportadora}} {{contratante}}</p><img src="cid:company-logo">')
  })

  it('variável desconhecida e nomes do protótipo saem vazios', () => {
    expect(render('[{{foo}}][{{constructor}}][{{__proto__}}][{{toString}}]')).toBe('[][][][]')
  })

  it('o texto do modelo nunca é escapado', () => {
    expect(render('<a href="https://x.com/?a=1&b=2">a & b</a>')).toBe('<a href="https://x.com/?a=1&b=2">a & b</a>')
  })

  it('quebra de linha do valor vira <br> no HTML e volta como quebra no texto', () => {
    const html = render('<p>{{observacao}}</p>', { observacao: 'a\nb\r\nc' })

    expect(html).toBe('<p>a<br>b<br>c</p>')
    expect(htmlToPlainText(html)).toBe('a\nb\nc')
  })
})

describe('escapeEmailHtml', () => {
  it('& primeiro, depois < > " \'', () => {
    expect(escapeEmailHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('buildInitials: casos da 272', () => {
  it('as primeiras letras das duas primeiras palavras, em maiúscula; pontuação solta não conta', () => {
    expect(buildInitials('Maria da Silva')).toBe('MD')
    expect(buildInitials('alfa transportes ltda')).toBe('AT')
    expect(buildInitials('  Zé  ')).toBe('Z')
    expect(buildInitials('Ágata Çelik')).toBe('ÁÇ')
    expect(buildInitials('')).toBe('')
    expect(buildInitials('— · —')).toBe('')
  })
})

describe('renderEmailLogoHtml: casos da 272 (buildLogo)', () => {
  it('com logo: <img> por cid, com o nome de exibição escapado no alt', () => {
    const html = renderEmailLogoHtml({
      displayName: 'A&B "C"',
      logo: { contentId: 'company-logo', kind: 'cid' },
    })

    expect(html).toContain('<img src="cid:company-logo"')
    expect(html).toContain('alt="A&amp;B &quot;C&quot;"')
    expect(html).toContain('width="48" height="48"')
  })

  it('sem logo: quadrado de tabela com as iniciais, sem <img> e sem cid', () => {
    const html = renderEmailLogoHtml({
      displayName: '<b>Alfa</b> Transportes',
      logo: { kind: 'initials' },
    })

    expect(html).not.toContain('<img')
    expect(html).not.toContain('cid:')
    expect(html).toContain('<table')
    expect(html).not.toContain('<b>')
    expect(html).toContain('>T<')
  })

  it('iniciais simples', () => {
    expect(renderEmailLogoHtml({ displayName: 'Alfa Transportes', logo: { kind: 'initials' } })).toContain('>AT<')
  })

  it('cores do tema nas iniciais', () => {
    const html = renderEmailLogoHtml({ displayName: 'Alfa', logo: { kind: 'initials' } })

    expect(html).toContain(`background:${STANDARD_EMAIL_THEME.colors.asphalt}`)
    expect(html).toContain(`color:${STANDARD_EMAIL_THEME.colors.copper}`)
  })
})

describe('renderEmailMarksHtml: casos da 272 (buildFooterMarks)', () => {
  const TEXT = 'Enviado pelo TransportAdA — uma solução Ada Technology'

  it('com as duas URLs: as duas marcas e o texto', () => {
    const html = renderEmailMarksHtml({
      platformMarkUrl: 'https://app.example.test/icons/ada-technology.png',
      productMarkUrl: 'https://app.example.test/icons/icon-192.png',
      text: TEXT,
    })

    expect(html).toContain('src="https://app.example.test/icons/icon-192.png"')
    expect(html).toContain('src="https://app.example.test/icons/ada-technology.png"')
    expect(html).toContain(TEXT)
  })

  it('sem URL: só o texto, nenhuma imagem', () => {
    const html = renderEmailMarksHtml({ text: TEXT })

    expect(html).toContain(TEXT)
    expect(html).not.toContain('<img')
  })

  it('URL que não é http(s) não vira src', () => {
    const html = renderEmailMarksHtml({
      platformMarkUrl: 'data:image/png;base64,AAAA',
      productMarkUrl: 'javascript:alert(1)',
      text: TEXT,
    })

    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript')
    expect(html).not.toContain('data:')
  })

  it('aspas na URL saem escapadas', () => {
    const html = renderEmailMarksHtml({ productMarkUrl: 'https://a.example.test/"x.png', text: TEXT })

    expect(html).not.toContain('"x')
    expect(html).toContain('&quot;x')
  })

  it('sem texto nem URL válida: vazio', () => {
    expect(renderEmailMarksHtml({ productMarkUrl: 'ftp://x' })).toBe('')
  })
})

describe('STANDARD_EMAIL_THEME: cores e fonte da 272', () => {
  it('valores literais do desenho aprovado', () => {
    expect(STANDARD_EMAIL_THEME.colors).toEqual({
      asphalt: '#10222c',
      copper: '#d58a47',
      ink: '#1d2b33',
      mist: '#f0f2ee',
      rule: '#d9ded8',
      slate: '#5a6b74',
    })
    expect(STANDARD_EMAIL_THEME.font).toBe('Arial,Helvetica,sans-serif')
    expect(STANDARD_EMAIL_THEME.logoSize).toBe(48)
  })
})
