/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { STANDARD_EMAIL_BUILTIN_TEMPLATE, STANDARD_EMAIL_TEMPLATE_KEY } from '@adatechnology/notification-contracts'

import { assessStandardEmailDraft, buildStandardEmailPreviewHtml, isStandardEmailKey } from './standardEmail.util'

describe('isStandardEmailKey', () => {
  it('reconhece só a chave do modelo padrão', () => {
    expect(isStandardEmailKey(STANDARD_EMAIL_TEMPLATE_KEY)).toBe(true)
    expect(isStandardEmailKey('notification.standard-email-2')).toBe(false)
    expect(isStandardEmailKey('auth.password_reset')).toBe(false)
  })
})

describe('assessStandardEmailDraft', () => {
  it('o modelo embutido é utilizável', () => {
    const result = assessStandardEmailDraft(STANDARD_EMAIL_BUILTIN_TEMPLATE.html)
    expect(result.usable).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.unsafe).toEqual([])
  })

  it('lista as obrigatórias que faltam, sem depender da área de mensagem', () => {
    const result = assessStandardEmailDraft('<p>{{nomeEmpresa}}</p>')
    expect(result.usable).toBe(false)
    expect(result.missing).toContain('corpoMensagem')
    expect(result.missing).not.toContain('nomeEmpresa')
  })

  it('lista o HTML inseguro', () => {
    const result = assessStandardEmailDraft(`${STANDARD_EMAIL_BUILTIN_TEMPLATE.html}<script>x()</script>`)
    expect(result.usable).toBe(false)
    expect(result.unsafe).toContain('tag')
  })
})

describe('buildStandardEmailPreviewHtml', () => {
  it('renderiza o modelo com os exemplos do catálogo, sem sobrar variável', () => {
    const html = buildStandardEmailPreviewHtml(STANDARD_EMAIL_BUILTIN_TEMPLATE.html)
    expect(html).toContain('Alfa Transportes')
    expect(html).toContain('Maria da Silva')
    expect(html).not.toContain('{{')
  })

  it('o {{x}} literal do operador não vira conteúdo', () => {
    const html = buildStandardEmailPreviewHtml(`${STANDARD_EMAIL_BUILTIN_TEMPLATE.html}<p>{{naoExiste}}</p>`)
    expect(html).not.toContain('Alfa Transportes{{')
  })
})
