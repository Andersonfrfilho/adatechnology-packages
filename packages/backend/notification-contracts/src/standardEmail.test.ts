/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O modelo padrão de e-mail (spec 274 T1.2, plan D3): identidade, assinante e rodapé são marcação do modelo, o
 * texto do usuário é sempre escapado e nenhuma variável entra em atributo ou `style`.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import { findUnsafeEmailHtml, htmlToPlainText } from './emailHtml'
import {
  STANDARD_EMAIL_BUILTIN_TEMPLATE,
  STANDARD_EMAIL_CHANNEL,
  STANDARD_EMAIL_HTML_MAX_BYTES,
  STANDARD_EMAIL_LOCALE,
  STANDARD_EMAIL_REQUIRED_VARIABLES,
  STANDARD_EMAIL_SYSTEM_HTML_VARIABLES,
  STANDARD_EMAIL_TEMPLATE_KEY,
  STANDARD_EMAIL_VARIABLES,
  assessStandardEmailTemplate,
  renderStandardEmail,
} from './standardEmail'
import type { StandardEmailInput, StandardEmailTemplate } from './standardEmail'
import { STANDARD_EMAIL_PT_BR_HTML } from './templates/standardEmailTemplate.generated'
import { extractTemplatePlaceholders } from './templateRender'

const MARK_PRODUCT = 'https://app.example.test/icons/icon-192.png'
const MARK_PLATFORM = 'https://app.example.test/icons/ada-technology.png'

function input(overrides: Partial<StandardEmailInput> = {}): StandardEmailInput {
  return {
    attachments: [{ name: 'nota-1.pdf' }],
    bodyText: 'Olá,\nsegue a nota.\n\nAtenciosamente.',
    footer: {
      platformMarkUrl: MARK_PLATFORM,
      platformNote: 'Enviado pelo TransportAdA — uma solução Ada Technology',
      productMarkUrl: MARK_PRODUCT,
    },
    identity: { displayName: 'Alfa Transportes', logo: { contentId: 'company-logo', kind: 'cid' } },
    signer: { name: 'Maria da Silva', role: 'Analista' },
    ...overrides,
  }
}

const BUILTIN = STANDARD_EMAIL_BUILTIN_TEMPLATE

function render(overrides: Partial<StandardEmailInput> = {}, template: StandardEmailTemplate = BUILTIN) {
  return renderStandardEmail({ input: input(overrides), template })
}

describe('constantes e catálogo', () => {
  it('identidade do modelo', () => {
    expect(STANDARD_EMAIL_TEMPLATE_KEY).toBe('notification.standard-email')
    expect(STANDARD_EMAIL_CHANNEL).toBe('email')
    expect(STANDARD_EMAIL_LOCALE).toBe('pt-BR')
  })

  it('HTML do sistema: conjunto fechado; obrigatórias: identidade, assinante e rodapé', () => {
    expect([...STANDARD_EMAIL_SYSTEM_HTML_VARIABLES].sort()).toEqual([
      'corpoMensagem',
      'faixaResposta',
      'listaAnexos',
      'logoEmpresa',
      'marcasRodape',
    ])
    expect([...STANDARD_EMAIL_REQUIRED_VARIABLES].sort()).toEqual([
      'corpoMensagem',
      'logoEmpresa',
      'marcasRodape',
      'nomeAssinante',
      'nomeEmpresa',
      'rodapePlataforma',
    ])
  })

  it('o catálogo tem as dez variáveis, com exemplo, e marca as obrigatórias', () => {
    const names = STANDARD_EMAIL_VARIABLES.map((variable) => variable.name).sort()

    expect(names).toEqual([
      'cargoAssinante',
      'corpoMensagem',
      'faixaResposta',
      'iniciaisAssinante',
      'listaAnexos',
      'logoEmpresa',
      'marcasRodape',
      'nomeAssinante',
      'nomeEmpresa',
      'rodapePlataforma',
    ])
    for (const variable of STANDARD_EMAIL_VARIABLES) {
      expect(variable.example).not.toBe('')
      expect(variable.required).toBe(STANDARD_EMAIL_REQUIRED_VARIABLES.includes(variable.name as never))
    }
  })

  it('o modelo embutido usa só variáveis do catálogo', () => {
    const catalog = new Set(STANDARD_EMAIL_VARIABLES.map((variable) => variable.name))

    for (const name of extractTemplatePlaceholders(BUILTIN.html)) expect(catalog.has(name)).toBe(true)
  })
})

describe('o embutido', () => {
  it('é o arquivo .html versionado (o .ts gerado não envelhece)', () => {
    const file = readFileSync(`${__dirname}/templates/standard-email.pt-BR.html`, 'utf8')

    expect(STANDARD_EMAIL_PT_BR_HTML).toBe(file)
    expect(BUILTIN).toEqual({ html: file, source: 'builtin', version: 0 })
  })

  it('passa no próprio assess', () => {
    expect(assessStandardEmailTemplate(BUILTIN.html)).toEqual({ missing: [], unsafe: [], usable: true })
    expect(findUnsafeEmailHtml(BUILTIN.html)).toEqual([])
  })

  it('estrutura: tabelas e estilo inline, sem conteúdo ativo, flex, grid ou var(', () => {
    const { html } = render()

    expect(html).not.toMatch(/<script/iu)
    expect(html).not.toMatch(/\son[a-z]+\s*=/iu)
    expect(html).not.toMatch(/flex|grid|var\(/iu)
    expect(html).not.toContain('<style')
    expect(html).toContain('width="620"')
    expect(html).toContain('<table')
    expect(findUnsafeEmailHtml(html)).toEqual([])
  })

  it('nenhuma variável em atributo ou style: o modelo é seguro mesmo com {{ }} (placeholder_in_tag vazio)', () => {
    expect(findUnsafeEmailHtml(BUILTIN.html)).not.toContain('placeholder_in_tag')
  })
})

describe('escape de cada variável', () => {
  const EVIL = '<img src=x onerror=alert(1)>&"\''
  const ESCAPED = '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;'

  it('nome da empresa (texto e alt do logo)', () => {
    const { html } = render({ identity: { displayName: EVIL, logo: { contentId: 'company-logo', kind: 'cid' } } })

    expect(html).not.toContain('<img src=x')
    expect(html).toContain(ESCAPED)
  })

  it('nome e cargo do assinante, e as iniciais', () => {
    const { html } = render({ signer: { name: `<b>Zé</b> ${EVIL}`, role: EVIL } })

    expect(html).not.toContain('<b>Zé')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;b&gt;Zé&lt;/b&gt;')
    expect(html).toContain(`color:#5a6b74">${ESCAPED}</div>`)
  })

  it('nota do rodapé', () => {
    const { html } = render({ footer: { platformNote: EVIL } })

    expect(html).not.toContain('<img src=x')
    expect(html).toContain(ESCAPED)
  })

  it('corpo da mensagem', () => {
    const { html } = render({ bodyText: EVIL })

    expect(html).not.toContain('<img src=x')
    expect(html).toContain(ESCAPED)
  })

  it('nome do anexo', () => {
    const { html } = render({ attachments: [{ name: EVIL }] })

    expect(html).not.toContain('<img src=x')
    expect(html).toContain(ESCAPED)
  })

  it('replyHint', () => {
    const { html } = render({ replyHint: EVIL })

    expect(html).not.toContain('<img src=x')
    expect(html).toContain(ESCAPED)
  })

  it('values extras do host, num modelo da empresa que os use', () => {
    const template = { html: '<p>{{observacao}}</p>', source: 'company', version: 3 } as const
    const { html } = render({ values: { observacao: EVIL } }, template)

    expect(html).toBe(`<p>${ESCAPED}</p>`)
  })

  it('values extras não sobrescrevem as variáveis do sistema', () => {
    const { html } = render(
      { values: { corpoMensagem: '<b>x</b>', nomeEmpresa: 'Falsa', logoEmpresa: '<i>y</i>' } },
      { html: '{{nomeEmpresa}}|{{corpoMensagem}}|{{logoEmpresa}}', source: 'company', version: 1 },
    )

    expect(html).not.toContain('Falsa')
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<i>y</i>')
    expect(html.startsWith('Alfa Transportes|')).toBe(true)
  })
})

describe('{{x}} do operador é literal', () => {
  it('no corpo, no nome do anexo, na nota e no assinante', () => {
    const { html } = render({
      attachments: [{ name: '{{nomeAssinante}}.pdf' }],
      bodyText: 'Oi {{nomeEmpresa}} {{logoEmpresa}} {{marcasRodape}}',
      footer: { platformNote: '{{corpoMensagem}}' },
      signer: { name: '{{nomeEmpresa}}' },
    })

    expect(html).toContain('Oi {{nomeEmpresa}} {{logoEmpresa}} {{marcasRodape}}')
    expect(html).toContain('{{nomeAssinante}}.pdf')
    expect(html).toContain('{{corpoMensagem}}')
    expect(html).toContain('>{{nomeEmpresa}}</div>')
  })
})

describe('corpo', () => {
  it('linha em branco → parágrafo; quebra simples → <br>', () => {
    const { html } = render({ bodyText: 'a\nb\r\n\r\nc\n\n\n\nd' })

    expect(html).toContain('<p style="margin:0 0 14px">a<br>b</p>')
    expect(html).toContain('<p style="margin:0 0 14px">c</p>')
    expect(html).toContain('<p style="margin:0 0 14px">d</p>')
  })
})

describe('marcas do rodapé', () => {
  it('URL que não é http(s) → sem imagem', () => {
    const { html } = render({
      footer: {
        platformMarkUrl: 'data:image/png;base64,AAAA',
        platformNote: 'n',
        productMarkUrl: 'javascript:alert(1)',
      },
      identity: { displayName: 'Alfa', logo: { kind: 'initials' } },
    })

    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript')
    expect(html).not.toContain('data:image')
  })

  it('http(s) → as duas imagens; a nota continua no rodapé', () => {
    const { html } = render()

    expect(html).toContain(`src="${MARK_PRODUCT}"`)
    expect(html).toContain(`src="${MARK_PLATFORM}"`)
    expect(html).toContain('Enviado pelo TransportAdA')
  })
})

describe('logo', () => {
  it('cid: <img src="cid:…"> e sem iniciais da empresa', () => {
    const { html } = render()

    expect(html).toContain('<img src="cid:company-logo"')
  })

  it('iniciais: quadrado de tabela, sem cid e sem <img> de logo', () => {
    const { html } = render({
      footer: { platformNote: 'n' },
      identity: { displayName: 'Alfa Transportes', logo: { kind: 'initials' } },
    })

    expect(html).not.toContain('cid:')
    expect(html).not.toContain('<img')
    expect(html).toContain('>AT<')
  })
})

describe('partes opcionais', () => {
  it('sem anexos: nenhuma lista; com anexos: os nomes', () => {
    expect(render({ attachments: [] }).html).not.toContain('Anexos')
    const { html, text } = render({ attachments: [{ name: 'a.pdf' }, { name: 'b.xml' }] })

    expect(html).toContain('Anexos')
    expect(text).toContain('a.pdf')
    expect(text).toContain('b.xml')
  })

  it('sem cargo: o assinante sai sem cargo e sem "undefined"', () => {
    const { html, text } = render({ signer: { name: 'Maria da Silva' } })

    expect(html).toContain('MD')
    expect(html).toContain('Maria da Silva')
    expect(html).not.toContain('undefined')
    expect(text).not.toContain('undefined')
  })

  it('sem replyHint: sem faixa; com replyHint: a faixa', () => {
    expect(render().html).not.toContain('border-left:3px solid #d58a47')
    const { html } = render({ replyHint: 'Responda este e-mail.' })

    expect(html).toContain('border-left:3px solid #d58a47')
    expect(html).toContain('Responda este e-mail.')
  })
})

describe('tamanho e texto', () => {
  it('< 100 KB com 8000 caracteres e 5 anexos; tooLarge falso', () => {
    const result = render({
      attachments: Array.from({ length: 5 }, (_, index) => ({ name: `arquivo-${index}.pdf` })),
      bodyText: 'á'.repeat(8000),
    })

    expect(result.bytes).toBe(Buffer.byteLength(result.html, 'utf8'))
    expect(result.bytes).toBeLessThan(100 * 1024)
    expect(result.tooLarge).toBe(false)
  })

  it('tooLarge acima de 524288 bytes', () => {
    expect(STANDARD_EMAIL_HTML_MAX_BYTES).toBe(524288)
    expect(render({ bodyText: 'a'.repeat(STANDARD_EMAIL_HTML_MAX_BYTES) }).tooLarge).toBe(true)
  })

  it('text é htmlToPlainText(html), sem tags, com o corpo e a assinatura', () => {
    const { html, text } = render()

    expect(text).toBe(htmlToPlainText(html))
    expect(text).not.toMatch(/<\/?[a-zA-Z]/u)
    expect(text).toContain('Olá,\nsegue a nota.')
    expect(text).toContain('Maria da Silva')
    expect(text).toContain('Analista')
    expect(text).toContain('Alfa Transportes')
  })

  it('template: key, version e source do que foi renderizado', () => {
    expect(render().template).toEqual({ key: 'notification.standard-email', source: 'builtin', version: 0 })
    expect(render({}, { html: BUILTIN.html, source: 'company', version: 4 }).template).toEqual({
      key: 'notification.standard-email',
      source: 'company',
      version: 4,
    })
  })
})

describe('assessStandardEmailTemplate', () => {
  it('sem cada obrigatória → inutilizável, e diz qual', () => {
    for (const name of STANDARD_EMAIL_REQUIRED_VARIABLES) {
      const html = BUILTIN.html.replaceAll(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'gu'), '')
      const assessment = assessStandardEmailTemplate(html)

      expect(assessment.usable).toBe(false)
      expect(assessment.missing).toEqual([name])
    }
  })

  it('aceita espaços dentro das chaves', () => {
    expect(assessStandardEmailTemplate(BUILTIN.html.replace('{{nomeEmpresa}}', '{{ nomeEmpresa }}')).usable).toBe(true)
  })

  it('inseguro → inutilizável, e diz a regra', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['<script>x</script>', 'tag'],
      ['<a href="#" onclick="x()">a</a>', 'event'],
      ['<a href="javascript:x">a</a>', 'scheme'],
      ['<p style="color:{{nomeEmpresa}}">a</p>', 'placeholder_in_tag'],
    ]
    for (const [extra, rule] of cases) {
      const assessment = assessStandardEmailTemplate(`${BUILTIN.html}${extra}`)

      expect(assessment.usable).toBe(false)
      expect(assessment.unsafe).toContain(rule as never)
      expect(assessment.missing).toEqual([])
    }
  })

  it('vazio → inutilizável com todas as obrigatórias faltando', () => {
    const assessment = assessStandardEmailTemplate('')

    expect(assessment.usable).toBe(false)
    expect([...assessment.missing].sort()).toEqual([...STANDARD_EMAIL_REQUIRED_VARIABLES].sort())
  })
})
