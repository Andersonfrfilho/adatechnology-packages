/**
 * O que estes testes protegem é a propriedade de segurança da ponte: nenhum caminho pode voltar a
 * exigir segredo no navegador, e o corpo enviado tem que ser a INTENÇÃO — se um refactor passar a
 * mandar payload da Meta montado no cliente, a rota do host vira injetor de webhook arbitrário.
 */

import { describe, expect, it } from 'bun:test'

import { createPreviewBridgeClient, PreviewBridgeRejectedError } from './createPreviewBridgeClient'
import type { PreviewInboundCommand } from './createPreviewBridgeClient'

const FROM = '5511999999999'

function createRecordingClient() {
  const commands: PreviewInboundCommand[] = []
  const client = createPreviewBridgeClient({
    from: FROM,
    sendCommand: async (command) => {
      commands.push(command)
    },
  })
  return { client, commands }
}

describe('createPreviewBridgeClient', () => {
  it('entrega a intenção do cliente, carimbando o remetente em cada comando', async () => {
    const { client, commands } = createRecordingClient()

    await client.sendText('quero simular')
    await client.sendButtonReply({ id: 'hab_pronto', title: 'Imóvel pronto' })
    await client.sendListReply({ id: 'faixa_2', title: 'Faixa 2' })
    await client.sendAudio('media-1')
    await client.sendMedia({ mediaType: 'document', mediaId: 'media-2', filename: 'rg.pdf' })

    expect(commands).toEqual([
      { kind: 'text', from: FROM, text: 'quero simular' },
      { kind: 'buttonReply', from: FROM, reply: { id: 'hab_pronto', title: 'Imóvel pronto' } },
      { kind: 'listReply', from: FROM, reply: { id: 'faixa_2', title: 'Faixa 2' } },
      { kind: 'audio', from: FROM, mediaId: 'media-1' },
      { kind: 'media', from: FROM, mediaType: 'document', mediaId: 'media-2', filename: 'rg.pdf' },
    ])
  })

  it('nunca embute assinatura nem segredo no que sai do navegador', async () => {
    const { client, commands } = createRecordingClient()

    await client.sendText('oi')

    const serialized = JSON.stringify(commands[0])
    expect(serialized).not.toMatch(/sha256=/)
    expect(serialized).not.toMatch(/secret/i)
    expect(commands[0]).not.toHaveProperty('entry')
  })

  it('posta no endpoint do host com os headers de sessão que o host injeta', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const client = createPreviewBridgeClient({
      from: FROM,
      endpointUrl: 'https://host.test/api/conversations/preview/inbound',
      headers: { authorization: 'Bearer token-do-painel' },
      fetchImplementation: (async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return { ok: true } as Response
      }) as unknown as typeof fetch,
    })

    await client.sendText('oi')

    expect(calls[0]?.url).toBe('https://host.test/api/conversations/preview/inbound')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer token-do-painel',
    })
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ kind: 'text', from: FROM, text: 'oi' })
  })

  it('converte recusa do host em erro tipado, para o painel poder mostrar o motivo', async () => {
    const client = createPreviewBridgeClient({
      from: FROM,
      endpointUrl: 'https://host.test/preview',
      fetchImplementation: (async () => ({ ok: false, status: 403 }) as Response) as unknown as typeof fetch,
    })

    await expect(client.sendText('oi')).rejects.toBeInstanceOf(PreviewBridgeRejectedError)
    await expect(client.sendText('oi')).rejects.toThrow(/403/)
  })

  it('recusa configuração sem forma de entregar, em vez de falhar só no primeiro envio', () => {
    expect(() => createPreviewBridgeClient({ from: FROM })).toThrow(/sendCommand.*endpointUrl/)
  })
})
