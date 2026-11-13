/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { createWhatsAppProvider } from './WhatsAppProviderFactory'
import { WhatsAppMessageProvider } from './WhatsAppMessageProvider'
import { WhatsAppTemplateProvider } from './WhatsAppTemplateProvider'

describe('createWhatsAppProvider', () => {
  test('builds a messages and templates provider sharing the same credential', () => {
    const provider = createWhatsAppProvider({
      accessToken: 'fixture-token',
      phoneNumberId: 'phone-1',
      wabaId: 'waba-1',
    })

    expect(provider.messages).toBeInstanceOf(WhatsAppMessageProvider)
    expect(provider.templates).toBeInstanceOf(WhatsAppTemplateProvider)
  })
})
