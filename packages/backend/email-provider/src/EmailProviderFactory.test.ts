/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createEmailProvider } from './EmailProviderFactory'

describe('createEmailProvider', () => {
  it('cria o driver smtp', () => {
    const provider = createEmailProvider({
      driver: 'smtp',
      from: 'a@b.com',
      transportClient: { sendMail: async () => ({ messageId: 'x', accepted: [], rejected: [] }) },
    })
    expect(provider.driver).toBe('smtp')
  })

  it('cria o driver resend', () => {
    const provider = createEmailProvider({
      driver: 'resend',
      from: 'a@b.com',
      client: { emails: { send: async () => ({ data: { id: 'x' }, error: null }) } },
    })
    expect(provider.driver).toBe('resend')
  })

  it('cria o driver ses', () => {
    const provider = createEmailProvider({
      driver: 'ses',
      from: 'a@b.com',
      client: { sendEmail: async () => ({ messageId: 'x' }) },
    })
    expect(provider.driver).toBe('ses')
  })

  it('rejeita driver desconhecido em runtime, mesmo escapando o tipo', () => {
    const params = { driver: 'mailgun', from: 'a@b.com' } as unknown as Parameters<typeof createEmailProvider>[0]
    expect(() => createEmailProvider(params)).toThrow(/desconhecido/)
  })
})
