/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildMimeMessage } from './buildMimeMessage'

const PDF = new TextEncoder().encode('%PDF-1.4 conteudo')

function build(overrides: Partial<Parameters<typeof buildMimeMessage>[0]> = {}): string {
  return new TextDecoder().decode(
    buildMimeMessage({
      from: 'Ada <nao-responda@ada.tech>',
      to: 'cliente@example.com',
      subject: 'Sua nota',
      html: '<p>Segue a nota.</p>',
      text: 'Segue a nota.',
      attachments: [{ filename: 'nota.pdf', contentType: 'application/pdf', content: PDF }],
      ...overrides,
    }),
  )
}

function boundaryOf(mime: string, header: string): string {
  return new RegExp(`${header}; boundary="([^"]+)"`).exec(mime)?.[1] ?? ''
}

describe('buildMimeMessage', () => {
  /**
   * A estrutura e o que decide se o cliente mostra o texto ou o anexo. Com `alternative` no mesmo
   * nivel do anexo, o PDF viraria uma "versao alternativa" do corpo e poderia aparecer NO LUGAR
   * dele.
   */
  it('aninha multipart/alternative DENTRO de multipart/mixed', () => {
    const mime = build()
    const mixed = boundaryOf(mime, 'multipart/mixed')
    const alternative = boundaryOf(mime, 'multipart/alternative')

    expect(mixed).not.toBe('')
    expect(mixed).not.toBe(alternative)
    expect(mime.indexOf(`--${mixed}`)).toBeLessThan(mime.indexOf('multipart/alternative'))
    expect(mime.indexOf(`--${alternative}--`)).toBeLessThan(mime.indexOf('Content-Disposition: attachment'))
  })

  it('fecha as duas fronteiras, e a externa por ultimo', () => {
    const mime = build()
    const mixed = boundaryOf(mime, 'multipart/mixed')
    const alternative = boundaryOf(mime, 'multipart/alternative')

    expect(mime).toContain(`--${alternative}--`)
    expect(mime.trimEnd().endsWith(`--${mixed}--`)).toBe(true)
  })

  it('separa linhas com CRLF, que e o que o SMTP exige', () => {
    expect(build()).toContain('MIME-Version: 1.0\r\n')
  })

  it('leva as duas versoes do corpo, em base64', () => {
    const mime = build()

    expect(mime).toContain('Content-Type: text/plain; charset=utf-8')
    expect(mime).toContain('Content-Type: text/html; charset=utf-8')
    expect(mime).toContain(Buffer.from('Segue a nota.').toString('base64'))
    expect(mime).toContain(Buffer.from('<p>Segue a nota.</p>').toString('base64'))
  })

  it('anexa com nome, tipo e disposition', () => {
    const mime = build()

    expect(mime).toContain('Content-Type: application/pdf; name="nota.pdf"')
    expect(mime).toContain('Content-Disposition: attachment; filename="nota.pdf"')
    expect(mime).toContain(Buffer.from(PDF).toString('base64'))
  })

  /** Cabecalho e ASCII (RFC 5322): acento cru chega como byte quebrado. */
  it('codifica assunto com acento em RFC 2047, e deixa ASCII em paz', () => {
    expect(build({ subject: 'Confirmação' })).toContain(
      `=?UTF-8?B?${Buffer.from('Confirmação', 'utf8').toString('base64')}?=`,
    )
    expect(build({ subject: 'Sua nota' })).toContain('Subject: Sua nota\r\n')
  })

  it('quebra o base64 em 76 colunas, o limite do RFC 2045', () => {
    const grande = new Uint8Array(1000).fill(65)
    const mime = build({
      attachments: [{ filename: 'g.bin', contentType: 'application/octet-stream', content: grande }],
    })
    const linhas = mime.split('\r\n').filter((linha) => /^[A-Za-z0-9+/=]{20,}$/.test(linha))

    expect(linhas.length).toBeGreaterThan(1)
    expect(linhas.every((linha) => linha.length <= 76)).toBe(true)
  })

  it('Reply-To so aparece quando existe', () => {
    expect(build({ replyTo: 'suporte@ada.tech' })).toContain('Reply-To: suporte@ada.tech')
    expect(build()).not.toContain('Reply-To:')
  })

  /** Aspas no nome fechariam o parametro e o resto viraria diretiva MIME. */
  it('tira aspas e barra do nome do arquivo', () => {
    const mime = build({
      attachments: [{ filename: 'a"; x="b.pdf', contentType: 'application/pdf', content: PDF }],
    })

    expect(mime).toContain('filename="a; x=b.pdf"')
  })

  it('cada mensagem usa boundary proprio, para nunca colidir com o conteudo', () => {
    expect(boundaryOf(build(), 'multipart/mixed')).not.toBe(boundaryOf(build(), 'multipart/mixed'))
  })

  it('varios anexos viram varias partes', () => {
    const mime = build({
      attachments: [
        { filename: 'a.pdf', contentType: 'application/pdf', content: PDF },
        { filename: 'b.pdf', contentType: 'application/pdf', content: PDF },
      ],
    })

    expect(mime.split('Content-Disposition: attachment').length - 1).toBe(2)
  })
})
