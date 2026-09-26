/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF4: as portas são assinatura, sem comportamento de runtime — este teste não exercita nenhuma
 * delas, só prova que um dublê simples implementa cada uma e compila sob `strict`. Se um método
 * mudar de forma sem que os dublês acompanhem, é o `check` do pacote que reprova, não este arquivo.
 */
import { describe, expect, it } from 'bun:test'

import type {
  ClockPort,
  ConversationChannelPort,
  ConversationEmailTransportPort,
  ObjectStoragePort,
  TranscriberPort,
} from './ports'

const channelDouble: ConversationChannelPort = {
  async sendText() {
    return { providerMessageId: 'double-text-1' }
  },
  async sendAttachment() {
    return { providerMessageId: 'double-attachment-1' }
  },
}

const emailTransportDouble: ConversationEmailTransportPort = {
  deriveReplyAddress({ companyId, conversationId }) {
    return `reply+${companyId}-${conversationId}@example.test`
  },
  verifyReplyToken({ token }) {
    return token === 'valid-token'
  },
  async sendEmail() {
    return { providerMessageId: 'double-email-1' }
  },
  async recordRawInboundEmail() {
    return { sha256: '0'.repeat(64) }
  },
  async verifyDkim() {
    return 'aligned'
  },
}

const clockDouble: ClockPort = {
  now() {
    return new Date('2026-09-26T00:00:00.000Z')
  },
}

const objectStorageDouble: ObjectStoragePort = {
  async put() {},
  async get() {
    return new ReadableStream<Uint8Array>()
  },
  async delete() {},
  async createSignedDownload() {
    return new URL('https://example.test/download')
  },
  async createSignedUpload() {
    return new URL('https://example.test/upload')
  },
}

const transcriberDouble: TranscriberPort = {
  async transcribe() {
    return { text: 'transcrição de teste' }
  },
}

describe('dublês das portas do núcleo compilam sob strict', () => {
  it('ConversationChannelPort', async () => {
    expect(
      await channelDouble.sendText({ channel: 'whatsapp', to: '+5511999999999', messageId: 'm1', bodyText: 'oi' }),
    ).toEqual({
      providerMessageId: 'double-text-1',
    })
  })

  it('ConversationEmailTransportPort', async () => {
    expect(emailTransportDouble.deriveReplyAddress({ companyId: 'c1', conversationId: 'v1' })).toContain('c1-v1')
    expect(emailTransportDouble.verifyReplyToken({ companyId: 'c1', conversationId: 'v1', token: 'valid-token' })).toBe(
      true,
    )
    expect(await emailTransportDouble.verifyDkim({ rawMime: new Uint8Array(), fromAddress: 'a@b.test' })).toBe(
      'aligned',
    )
  })

  it('ClockPort, ObjectStoragePort e TranscriberPort', async () => {
    expect(clockDouble.now().getFullYear()).toBe(2026)
    await objectStorageDouble.put({
      bucket: 'b',
      key: 'k',
      body: new Uint8Array(),
      contentType: 'application/octet-stream',
      sha256: '0'.repeat(64),
    })
    expect(await transcriberDouble.transcribe({ bytes: new Uint8Array(), contentType: 'audio/ogg' })).toEqual({
      text: 'transcrição de teste',
    })
  })
})
