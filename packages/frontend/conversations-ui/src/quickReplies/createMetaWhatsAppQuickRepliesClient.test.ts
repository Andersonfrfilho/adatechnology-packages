import { describe, expect, it } from 'bun:test'

import type { QuickRepliesWorkspaceApi } from './useQuickRepliesWorkspace'
import { QuickRepliesApiError, createMetaWhatsAppQuickRepliesClient } from './createMetaWhatsAppQuickRepliesClient'

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return respond(call)
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const stored = { id: 'q1', title: 'Olá', shortcut: 'ola', body: 'Olá!', sortOrder: 0, createdAt: '', updatedAt: '' }

describe('createMetaWhatsAppQuickRepliesClient', () => {
  it('lista desembrulhando { data } e manda o cabeçalho do host e a busca', async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({ data: [stored] }))
    const client = createMetaWhatsAppQuickRepliesClient({
      baseUrl: '/v1/whatsapp',
      fetch: fetchImpl,
      getHeaders: async () => ({ authorization: 'Bearer t' }),
    })

    expect(await client.listQuickReplies({ search: ' olá & x ' })).toEqual([stored])
    expect(calls[0]?.url).toBe('/v1/whatsapp/quick-replies?search=ol%C3%A1+%26+x')
    expect(calls[0]?.init.method).toBe('GET')
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer t')

    await client.listQuickReplies()
    expect(calls[1]?.url).toBe('/v1/whatsapp/quick-replies')
  })

  it('cria e edita mandando só título, atalho e texto', async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({ data: stored }, 200))
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp', fetch: fetchImpl })
    const input = { title: 'Olá', shortcut: 'ola', body: 'Olá!', attachmentUploadIds: ['u1'] }

    await client.createQuickReply(input)
    await client.updateQuickReply('a/b', input)

    expect(calls[0]?.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ title: 'Olá', shortcut: 'ola', body: 'Olá!' })
    expect(calls[1]?.url).toBe('/v1/whatsapp/quick-replies/a%2Fb')
    expect(calls[1]?.init.method).toBe('PUT')
    expect((calls[1]?.init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('apaga e aceita o 204 sem corpo', async () => {
    const { calls, fetchImpl } = fakeFetch(() => new Response(null, { status: 204 }))
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp', fetch: fetchImpl })

    await expect(client.deleteQuickReply('q1')).resolves.toBeUndefined()
    expect(calls[0]?.init.method).toBe('DELETE')
  })

  it('erro de validação vira details { field, message } e o código estável chega à tela', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Requisição inválida.',
            issues: [{ path: 'shortcut', message: 'ruim' }],
          },
        },
        400,
      ),
    )
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp', fetch: fetchImpl })

    const error = await client
      .createQuickReply({ title: 'a', shortcut: 'A', body: 'b' })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(QuickRepliesApiError)
    expect((error as QuickRepliesApiError).status).toBe(400)
    expect((error as QuickRepliesApiError).details).toEqual([{ field: 'shortcut', message: 'ruim' }])
  })

  it('atalho em uso chega com o código que o QuickRepliesWorkspace reconhece', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json({ error: { code: 'QUICK_REPLY_SHORTCUT_TAKEN', message: 'Esse atalho já está em uso.' } }, 409),
    )
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp', fetch: fetchImpl })

    const error = await client
      .createQuickReply({ title: 'a', shortcut: 'a', body: 'b' })
      .catch((caught: unknown) => caught)
    expect((error as QuickRepliesApiError).code).toBe('QUICK_REPLY_SHORTCUT_TAKEN')
  })

  it('corpo de erro ilegível ainda vira QuickRepliesApiError com o status', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('<html>', { status: 502 }))
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp', fetch: fetchImpl })

    const error = await client.listQuickReplies().catch((caught: unknown) => caught)
    expect((error as QuickRepliesApiError).status).toBe(502)
    expect((error as QuickRepliesApiError).code).toBe('HTTP_ERROR')
  })

  it('satisfaz a porta do QuickRepliesWorkspace', () => {
    const client = createMetaWhatsAppQuickRepliesClient({ baseUrl: '/v1/whatsapp' })
    const api: QuickRepliesWorkspaceApi = client
    expect(typeof api.listQuickReplies).toBe('function')
  })
})
