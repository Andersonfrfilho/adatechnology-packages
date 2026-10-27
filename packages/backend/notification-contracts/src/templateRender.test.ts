/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Esta função é lida por DOIS lados: o `notification-module` para enviar, e a tela de configuração
 * para mostrar o preview. É o único jeito de o preview não poder divergir do que o cliente recebe —
 * e por isso o comportamento dela é contrato, não detalhe.
 */

import { describe, expect, it } from 'bun:test'

import { extractTemplatePlaceholders, interpolateTemplate, renderTemplate } from './templateRender'

describe('interpolateTemplate', () => {
  it('troca o campo pelo valor do payload', () => {
    expect(interpolateTemplate('Pedido {{shortCode}} saiu', { shortCode: 'QC-1042' })).toBe('Pedido QC-1042 saiu')
  })

  it('tolera espaço dentro das chaves, que é o que alguém digita', () => {
    expect(interpolateTemplate('Pedido {{ shortCode }}', { shortCode: 'X' })).toBe('Pedido X')
  })

  it('campo ausente vira vazio, NUNCA o literal `{{campo}}`', () => {
    // O literal na tela do cliente é pior que a frase incompleta: revela o mecanismo.
    expect(interpolateTemplate('Pedido {{ausente}} ok', {})).toBe('Pedido  ok')
  })

  it('null e undefined também viram vazio', () => {
    expect(interpolateTemplate('{{a}}|{{b}}', { a: null, b: undefined })).toBe('|')
  })

  it('número e booleano são convertidos, não ignorados', () => {
    expect(interpolateTemplate('{{n}} e {{b}}', { n: 3, b: true })).toBe('3 e true')
  })

  it('não interpreta o valor injetado como novo placeholder', () => {
    // Sem isto, um valor vindo do payload poderia injetar campo — e ler dado de outro contexto.
    expect(interpolateTemplate('{{a}}', { a: '{{b}}', b: 'segredo' })).toBe('{{b}}')
  })
})

describe('renderTemplate', () => {
  it('usa o subject como título quando existe', () => {
    const rendered = renderTemplate({
      channel: 'inbox',
      subject: 'Pedido {{shortCode}} pronto',
      body: 'Detalhe do pedido {{shortCode}}.',
      payload: { shortCode: 'QC-7' },
    })

    expect(rendered.title).toBe('Pedido QC-7 pronto')
    expect(rendered.body).toBe('Detalhe do pedido QC-7.')
  })

  it('sem subject, deriva o título do corpo — e é por isso que os dois viram iguais', () => {
    const rendered = renderTemplate({ channel: 'inbox', body: 'Pedido QC-7 pronto', payload: {} })

    expect(rendered.title).toBe('Pedido QC-7 pronto')
    expect(rendered.title).toBe(rendered.body)
  })

  it('corta título longo em vez de estourar o desenho da lista', () => {
    const rendered = renderTemplate({ channel: 'inbox', body: 'a'.repeat(200), payload: {} })

    expect(rendered.title.length).toBeLessThanOrEqual(121)
    expect(rendered.title.endsWith('…')).toBe(true)
  })

  it('só e-mail ganha HTML — prometer formatação no WhatsApp seria mentira', () => {
    const payload = { shortCode: 'QC-7' }

    expect(renderTemplate({ channel: 'email', body: 'linha1\nlinha2', payload }).html).toBe('linha1<br>linha2')
    expect(renderTemplate({ channel: 'whatsapp', body: 'linha1\nlinha2', payload }).html).toBeUndefined()
    expect(renderTemplate({ channel: 'inbox', body: 'x', payload }).html).toBeUndefined()
  })

  it('escapa HTML do payload no e-mail — nome de cliente é entrada não confiável', () => {
    const rendered = renderTemplate({
      channel: 'email',
      body: 'Olá {{name}}',
      payload: { name: '<script>alert(1)</script>' },
    })

    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('&lt;script&gt;')
  })
})

describe('extractTemplatePlaceholders', () => {
  it('lista os campos que o template pede, sem repetir', () => {
    expect(extractTemplatePlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })

  it('devolve vazio quando o template é texto puro', () => {
    expect(extractTemplatePlaceholders('sem campo nenhum')).toEqual([])
  })
})

describe('assunto não vira header novo', () => {
  it('quebra de linha no subject vira espaço, não uma segunda linha de header', () => {
    const rendered = renderTemplate({
      channel: 'email',
      subject: 'Pedido pronto\r\nBcc: atacante@example.com',
      body: 'corpo',
      payload: {},
    })

    expect(rendered.title).not.toContain('\n')
    expect(rendered.title).not.toContain('\r')
    expect(rendered.title).toBe('Pedido pronto Bcc: atacante@example.com')
  })

  it('o valor interpolado também é sanitizado, não só o texto do template', () => {
    const rendered = renderTemplate({
      channel: 'email',
      subject: 'Olá {{nome}}',
      body: 'corpo',
      payload: { nome: 'Ana\nBcc: atacante@example.com' },
    })

    expect(rendered.title).not.toContain('\n')
  })
})

describe('constraints do canal', () => {
  it('marca o assunto de e-mail que passa dos 78 caracteres da caixa de entrada', () => {
    const rendered = renderTemplate({ channel: 'email', subject: 'a'.repeat(90), body: 'x', payload: {} })
    const title = rendered.constraints.find((constraint) => constraint.field === 'title')

    expect(title).toEqual({ field: 'title', limit: 78, actual: 90, exceeded: true })
  })

  it('não marca o que cabe', () => {
    const rendered = renderTemplate({ channel: 'sms', subject: undefined, body: 'curto', payload: {} })

    expect(rendered.constraints).toEqual([{ field: 'body', limit: 160, actual: 5, exceeded: false }])
  })

  it('mede o texto já interpolado, que é o que o cliente recebe', () => {
    const rendered = renderTemplate({
      channel: 'sms',
      body: 'Olá {{nome}}',
      payload: { nome: 'a'.repeat(200) },
    })

    expect(rendered.constraints[0]?.exceeded).toBe(true)
  })

  it('canal sem limite declarado não inventa constraint', () => {
    expect(renderTemplate({ channel: 'desconhecido', body: 'x', payload: {} }).constraints).toEqual([])
  })
})
