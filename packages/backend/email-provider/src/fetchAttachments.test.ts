/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { EMAIL_ATTACHMENT_MAX_BYTES } from '@adatechnology/notification-contracts'

import { AttachmentFetchError, fetchAttachments } from './fetchAttachments'

const VALID = {
  filename: 'nota.pdf',
  url: 'https://storage.exemplo.com/notas/abc',
  contentType: 'application/pdf',
} as const

type FakeResponse = {
  readonly body?: string
  readonly status?: number
  readonly headers?: Record<string, string>
}

function fakeFetch({ body = 'conteudo', status = 200, headers }: FakeResponse): typeof fetch {
  return (async () => new Response(body, { status, ...(headers ? { headers } : {}) })) as unknown as typeof fetch
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'sem-erro'
  } catch (error) {
    return error instanceof AttachmentFetchError ? error.errorCode : 'outro-erro'
  }
}

describe('fetchAttachments', () => {
  it('sem anexo, nem tenta rede', async () => {
    expect(await fetchAttachments(undefined)).toEqual([])
    expect(await fetchAttachments([])).toEqual([])
  })

  it('baixa e devolve nome, tipo e bytes', async () => {
    const [attachment] = await fetchAttachments([VALID], fakeFetch({ body: 'meu-pdf' }))

    expect(attachment?.filename).toBe('nota.pdf')
    expect(attachment?.contentType).toBe('application/pdf')
    expect(new TextDecoder().decode(attachment?.content)).toBe('meu-pdf')
  })

  /** A validacao do contrato roda ANTES da rede: url fora de https nao vira requisicao. */
  it('recusa antes de qualquer rede', async () => {
    const nunca = (() => {
      throw new Error('nao deveria buscar')
    }) as unknown as typeof fetch

    expect(await codeOf(fetchAttachments([{ ...VALID, url: 'http://x/a.pdf' }], nunca))).toBe(
      'attachment_url_not_https',
    )
    expect(await codeOf(fetchAttachments([{ ...VALID, filename: '../etc/passwd' }], nunca))).toBe(
      'attachment_filename_unsafe',
    )
  })

  it('traduz falha de rede e status ruim em codigo proprio', async () => {
    const morto = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch

    expect(await codeOf(fetchAttachments([VALID], morto))).toBe('attachment_unreachable')
    expect(await codeOf(fetchAttachments([VALID], fakeFetch({ status: 403 })))).toBe('attachment_http_403')
  })

  /** Assinatura vencida chega como 403: e o caso mais comum de falha aqui. */
  it('objeto vazio nao vira anexo vazio', async () => {
    expect(await codeOf(fetchAttachments([VALID], fakeFetch({ body: '' })))).toBe('attachment_empty')
  })

  it('reprova pelo content-length antes de ler o corpo', async () => {
    const grande = fakeFetch({ headers: { 'content-length': String(EMAIL_ATTACHMENT_MAX_BYTES + 1) } })

    expect(await codeOf(fetchAttachments([VALID], grande))).toBe('attachment_too_large')
  })

  it('reprova acima de dez anexos', async () => {
    const muitos = Array.from({ length: 11 }, () => VALID)

    expect(await codeOf(fetchAttachments(muitos, fakeFetch({})))).toBe('attachment_count_exceeded')
  })

  /** Dez de 20MB passam um a um e produzem uma mensagem de 200MB que ninguem aceita. */
  it('reprova pela SOMA, e nao so por anexo', async () => {
    const metade = 'x'.repeat(Math.ceil(EMAIL_ATTACHMENT_MAX_BYTES / 2) + 1)
    const tres = [VALID, VALID, VALID]

    expect(await codeOf(fetchAttachments(tres, fakeFetch({ body: metade })))).toBe('attachment_total_too_large')
  })
})
