/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { markEmailForEnvironment } from './emailEnvironmentMark'
import type { EmailEnvironmentMark } from './emailEnvironmentMark'

const mark: EmailEnvironmentMark = { subjectPrefix: '[Teste] ', bannerText: 'Ambiente de homologação — dados de teste' }
const message = {
  subject: 'Reserva confirmada',
  html: '<html><body style="margin:0"><p>Oi</p></body></html>',
  text: 'Oi',
}

describe('markEmailForEnvironment', () => {
  it('prefixa o assunto, põe a faixa logo após <body> e a primeira linha do texto', () => {
    const marked = markEmailForEnvironment(message, mark)

    expect(marked.subject).toBe('[Teste] Reserva confirmada')
    expect(marked.html).toContain('<body style="margin:0"><table role="presentation"')
    expect(marked.html).toContain('Ambiente de homologação — dados de teste</td>')
    expect(marked.html.indexOf('data-environment-banner')).toBeLessThan(marked.html.indexOf('<p>Oi</p>'))
    expect(marked.text).toBe('[Ambiente de homologação — dados de teste]\n\nOi')
  })

  it('é idempotente: marcar de novo não duplica prefixo, faixa nem linha de texto', () => {
    const once = markEmailForEnvironment(message, mark)

    expect(markEmailForEnvironment(once, mark)).toEqual(once)
  })

  it('sem <body> a faixa vai no começo do HTML', () => {
    const marked = markEmailForEnvironment({ ...message, html: '<p>Oi</p>' }, mark)

    expect(marked.html.startsWith('<table role="presentation"')).toBe(true)
  })

  it('escapa o texto da faixa e aceita cores próprias', () => {
    const marked = markEmailForEnvironment(message, {
      ...mark,
      bannerText: 'a <b> & c',
      bannerBackground: '#000',
      bannerColor: '#fff',
    })

    expect(marked.html).toContain('a &lt;b&gt; &amp; c')
    expect(marked.html).toContain('background:#000;color:#fff')
  })

  it('preserva os demais campos da mensagem', () => {
    const marked = markEmailForEnvironment({ ...message, to: 'a@b.com' }, mark)

    expect(marked.to).toBe('a@b.com')
  })
})
