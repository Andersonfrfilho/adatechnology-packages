import { describe, expect, it } from 'bun:test'

import { createMetaWhatsAppModule } from './createMetaWhatsAppModule'

const nonceStore = { setIfAbsent: async () => true } as never
const config = { phoneNumberId: '1000', accessToken: 'token', webhookVerifyToken: 'verify', appSecret: 'secret' }

describe('createMetaWhatsAppModule — superfície nova', () => {
  it('expõe requestHuman, sendInteractive e o processamento da fila de entrada', () => {
    const module = createMetaWhatsAppModule({ db: {} as never, nonceStore, config })
    expect(typeof module.conversations.requestHuman.execute).toBe('function')
    expect(typeof module.conversations.send.sendInteractive).toBe('function')
    expect(typeof module.webhook.processInboundDispatch.execute).toBe('function')
  })
})
