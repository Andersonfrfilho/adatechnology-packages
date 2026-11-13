import { describe, expect, it } from 'bun:test'
import { WhatsAppWindowExpiredError } from '@adatechnology/meta-graph-core'
import { WindowExpiredError } from '@adatechnology/meta-whatsapp-contracts'
import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'

import { WhatsAppChannelAdapter } from './WhatsAppChannelAdapter'

function buildProvider(overrides: Partial<WhatsAppMessageProvider> = {}) {
  const calls: unknown[] = []
  const provider = {
    sendInteractiveButtons: async (params: unknown) => {
      calls.push(params)
      return { waMessageId: 'wamid.botao' }
    },
    ...overrides,
  } as unknown as WhatsAppMessageProvider

  return { provider, calls }
}

describe('WhatsAppChannelAdapter.sendInteractiveButtons', () => {
  it('traduz o vocabulario da porta para o do provider', async () => {
    const { provider, calls } = buildProvider()
    const adapter = new WhatsAppChannelAdapter(provider)

    const result = await adapter.sendInteractiveButtons({
      to: '5516999999999',
      body: 'Quer falar com alguem do time?',
      buttons: [
        { id: 'falar', title: 'Sim' },
        { id: 'voltar', title: 'Nao' },
      ],
    })

    expect(result).toEqual({ externalMessageId: 'wamid.botao' })
    expect(calls[0]).toEqual({
      to: '5516999999999',
      bodyText: 'Quer falar com alguem do time?',
      buttons: [
        { id: 'falar', title: 'Sim' },
        { id: 'voltar', title: 'Nao' },
      ],
    })
  })

  it('converte janela expirada do provider no erro de dominio', async () => {
    const { provider } = buildProvider({
      sendInteractiveButtons: async () => {
        throw new WhatsAppWindowExpiredError('janela de 24h fechada')
      },
    } as Partial<WhatsAppMessageProvider>)
    const adapter = new WhatsAppChannelAdapter(provider)

    await expect(
      adapter.sendInteractiveButtons({ to: '5516999999999', body: 'oi', buttons: [{ id: 'a', title: 'A' }] }),
    ).rejects.toBeInstanceOf(WindowExpiredError)
  })
})
