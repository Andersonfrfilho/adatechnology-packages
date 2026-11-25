import { describe, expect, it } from 'bun:test'
import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'

import { WhatsAppChannelAdapter } from './WhatsAppChannelAdapter'

function buildAdapter() {
  const calls: unknown[] = []
  const provider = {
    sendInteractiveList: async (params: unknown) => {
      calls.push(params)
      return { waMessageId: 'wamid.lista' }
    },
  } as unknown as WhatsAppMessageProvider
  return { adapter: new WhatsAppChannelAdapter(provider), calls }
}

describe('WhatsAppChannelAdapter.sendInteractiveList', () => {
  it('forma `rows`: uma seção com o rótulo do botão como título, como sempre foi', async () => {
    const { adapter, calls } = buildAdapter()

    const result = await adapter.sendInteractiveList({
      to: '5511999990000',
      body: 'Escolha',
      buttonLabel: 'Ver opções',
      rows: [{ id: 'a', title: 'A' }],
    })

    expect(result).toEqual({ externalMessageId: 'wamid.lista' })
    expect(calls[0]).toEqual({
      to: '5511999990000',
      bodyText: 'Escolha',
      buttonText: 'Ver opções',
      sections: [{ title: 'Ver opções', rows: [{ id: 'a', title: 'A' }] }],
    })
  })

  it('forma `sections`: várias seções, com descrição na linha', async () => {
    const { adapter, calls } = buildAdapter()

    await adapter.sendInteractiveList({
      to: '5511999990000',
      body: 'Escolha',
      buttonLabel: 'Ver opções',
      sections: [
        { title: 'Manhã', rows: [{ id: 'm1', title: '09:00', description: 'Com a equipe A' }] },
        { title: 'Tarde', rows: [{ id: 't1', title: '14:00' }] },
      ],
    })

    expect(calls[0]).toEqual({
      to: '5511999990000',
      bodyText: 'Escolha',
      buttonText: 'Ver opções',
      sections: [
        { title: 'Manhã', rows: [{ id: 'm1', title: '09:00', description: 'Com a equipe A' }] },
        { title: 'Tarde', rows: [{ id: 't1', title: '14:00' }] },
      ],
    })
  })
})
