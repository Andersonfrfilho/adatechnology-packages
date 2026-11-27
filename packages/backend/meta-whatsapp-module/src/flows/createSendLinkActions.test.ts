import { describe, expect, it } from 'bun:test'
import type { ChannelAdapterInterface, ConversationSession, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { createSendCtaUrlAction } from './createSendCtaUrlAction'
import { createSendLocationAction } from './createSendLocationAction'

const SESSION = { companyId: 'c1', whatsappNumber: '5500', flowKey: 'main', currentNodeId: 'n' } as unknown as ConversationSession

function setup(channelExtras: Partial<ChannelAdapterInterface>) {
  const logged: Record<string, unknown>[] = []
  const sent: unknown[] = []
  const channel = {
    sendText: async (to: string, body: string) => { sent.push({ text: body, to }); return { externalMessageId: 'w1' } },
    ...channelExtras,
  } as unknown as ChannelAdapterInterface
  const base = {
    logMessage: { execute: async (entry: Record<string, unknown>) => { logged.push(entry) } },
    startState: 'start' as never,
    variablesFor: ({ context }: { context: Record<string, unknown> }) => context,
  }
  return { logged, sent, channel, base }
}

const node = (actionParams: Record<string, unknown>): FlowNodeData => ({ id: 'n', type: 'action', actionKind: 'x', actionParams })

describe('send_cta_url', () => {
  it('sends a button with the filled link, truncates the label to 20 characters and logs it', async () => {
    const sent: unknown[] = []
    const { logged, channel, base } = setup({ sendCtaUrl: async (params) => { sent.push(params); return { externalMessageId: 'w9' } } })
    await createSendCtaUrlAction(base)({
      node: node({ body: 'Veja *{{name}}*', displayText: 'Ver fotos e detalhes do pacote', url: 'https://x.test/{{slug}}' }),
      session: SESSION, channel, context: { name: 'Chalé', slug: 'chale' },
    })
    expect(sent).toEqual([{ to: '5500', body: 'Veja *Chalé*', displayText: 'Ver fotos e detalhe…', url: 'https://x.test/chale' }])
    expect(logged[0]).toMatchObject({ type: 'interactive', content: 'Veja *Chalé*', payload: { interactive: { kind: 'cta_url', url: 'https://x.test/chale' } } })
  })

  it('does nothing without an http(s) link', async () => {
    const sent: unknown[] = []
    const { logged, channel, base } = setup({ sendCtaUrl: async (params) => { sent.push(params); return { externalMessageId: 'w9' } } })
    await createSendCtaUrlAction(base)({ node: node({ body: 'b', displayText: 'Abrir', url: '{{missing}}' }), session: SESSION, channel, context: {} })
    await createSendCtaUrlAction(base)({ node: node({ body: 'b', displayText: 'Abrir', url: 'javascript:alert(1)' }), session: SESSION, channel, context: {} })
    expect(sent).toEqual([])
    expect(logged).toEqual([])
  })

  it('falls back to text with the link when the channel has no button', async () => {
    const { logged, sent, channel, base } = setup({})
    await createSendCtaUrlAction(base)({ node: node({ body: 'Oi', displayText: 'Abrir', url: 'https://x.test' }), session: SESSION, channel, context: {} })
    expect(sent).toEqual([{ text: 'Oi\nhttps://x.test', to: '5500' }])
    expect(logged[0]).toMatchObject({ type: 'text', content: 'Oi\nhttps://x.test' })
  })
})

describe('send_location', () => {
  it('sends the native location with the filled coordinates', async () => {
    const sent: unknown[] = []
    const { logged, channel, base } = setup({ sendLocation: async (params) => { sent.push(params); return { externalMessageId: 'w2' } } })
    await createSendLocationAction(base)({
      node: node({ latitude: '{{lat}}', longitude: '{{lng}}', name: 'Pousada', address: 'Rua 1' }),
      session: SESSION, channel, context: { lat: '-23.5', lng: '-46.6' },
    })
    expect(sent).toEqual([{ to: '5500', latitude: -23.5, longitude: -46.6, name: 'Pousada', address: 'Rua 1' }])
    expect(logged[0]).toMatchObject({ type: 'location', payload: { location: { latitude: -23.5, longitude: -46.6 } } })
  })

  it('skips when the coordinates are missing or out of range', async () => {
    const sent: unknown[] = []
    const { channel, base } = setup({ sendLocation: async (params) => { sent.push(params); return { externalMessageId: 'w2' } } })
    await createSendLocationAction(base)({ node: node({ latitude: '{{lat}}', longitude: '10' }), session: SESSION, channel, context: {} })
    await createSendLocationAction(base)({ node: node({ latitude: '95', longitude: '10' }), session: SESSION, channel, context: {} })
    expect(sent).toEqual([])
  })
})
