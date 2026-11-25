import { describe, expect, it } from 'bun:test'
import { ConfigMissingError } from '@adatechnology/meta-whatsapp-contracts'

import { createMetaWhatsAppModule } from './createMetaWhatsAppModule'
import { WhatsAppChannelAdapter } from './channel/WhatsAppChannelAdapter'
import { RecordingChannelAdapter } from './testing/RecordingChannelAdapter'

const nonceStore = { setIfAbsent: async () => true } as never
const baseConfig = { phoneNumberId: '1000', webhookVerifyToken: 'verify', appSecret: 'secret' }

describe('createMetaWhatsAppModule — canal injetável', () => {
  it('sem providers.channel monta o adaptador da Graph API, como sempre', () => {
    const module = createMetaWhatsAppModule({
      db: {} as never,
      nonceStore,
      config: { ...baseConfig, accessToken: 'token' },
    })
    expect(module.channel).toBeInstanceOf(WhatsAppChannelAdapter)
  })

  it('com providers.channel usa o canal do host e dispensa accessToken', () => {
    const channel = new RecordingChannelAdapter()
    const module = createMetaWhatsAppModule({ db: {} as never, nonceStore, config: baseConfig, providers: { channel } })
    expect(module.channel).toBe(channel)
  })

  it('sem canal e sem accessToken: ConfigMissingError no boot, não no primeiro envio', () => {
    expect(() => createMetaWhatsAppModule({ db: {} as never, nonceStore, config: baseConfig })).toThrow(
      ConfigMissingError,
    )
  })

  it('expõe requestHuman e sendInteractive', () => {
    const module = createMetaWhatsAppModule({
      db: {} as never,
      nonceStore,
      config: baseConfig,
      providers: { channel: new RecordingChannelAdapter() },
    })
    expect(typeof module.conversations.requestHuman.execute).toBe('function')
    expect(typeof module.conversations.send.sendInteractive).toBe('function')
  })
})
