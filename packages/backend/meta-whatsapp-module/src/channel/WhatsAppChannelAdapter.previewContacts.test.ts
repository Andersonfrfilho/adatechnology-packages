/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import { DEFAULT_PREVIEW_CONTACT } from '@adatechnology/meta-whatsapp-contracts'
import { WhatsAppChannelAdapter } from './WhatsAppChannelAdapter'

function recordingProvider() {
  const calls: string[] = []
  const provider = {
    sendText: async () => {
      calls.push('sendText')
      return { waMessageId: 'wamid.real' }
    },
    sendInteractiveButtons: async () => {
      calls.push('sendInteractiveButtons')
      return { waMessageId: 'wamid.real' }
    },
  } as unknown as WhatsAppMessageProvider
  return { provider, calls }
}

describe('WhatsAppChannelAdapter — preview contacts', () => {
  it('answers preview contacts without calling Meta when enabled', async () => {
    const { provider, calls } = recordingProvider()
    const adapter = new WhatsAppChannelAdapter(provider, undefined, { isEnabled: true, generateId: () => 'fixed' })

    expect(await adapter.sendText(DEFAULT_PREVIEW_CONTACT, 'oi')).toEqual({ externalMessageId: 'preview.fixed' })
    expect(
      await adapter.sendInteractiveButtons({
        to: DEFAULT_PREVIEW_CONTACT,
        body: 'b',
        buttons: [{ id: 'a', title: 'A' }],
      }),
    ).toEqual({ externalMessageId: 'preview.fixed' })
    expect(calls).toEqual([])
  })

  it('still calls Meta for real numbers, and for preview numbers when disabled', async () => {
    const { provider, calls } = recordingProvider()
    await new WhatsAppChannelAdapter(provider, undefined, { isEnabled: true }).sendText('5511999990000', 'oi')
    await new WhatsAppChannelAdapter(provider).sendText(DEFAULT_PREVIEW_CONTACT, 'oi')
    expect(calls).toEqual(['sendText', 'sendText'])
  })
})
