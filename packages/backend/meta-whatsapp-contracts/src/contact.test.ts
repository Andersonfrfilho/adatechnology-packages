/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { resolveContactProfileName, whatsAppWebhookValueSchema } from './webhook.types'

const contato = (wa_id: string, name?: string) => ({ wa_id, ...(name ? { profile: { name } } : {}) })

describe('nome de perfil do contato', () => {
  it('casa por wa_id', () => {
    const nome = resolveContactProfileName({
      contacts: [contato('5511999999999', 'Outra'), contato('5516993056772', 'Joana Pereira')],
      from: '5516993056772',
    })

    expect(nome).toBe('Joana Pereira')
  })

  it('com UM contato só, é dele mesmo sem casar — o nono dígito faz wa_id e from divergirem', () => {
    const nome = resolveContactProfileName({ contacts: [contato('551693056772', 'Joana')], from: '5516993056772' })

    expect(nome).toBe('Joana')
  })

  it('com DOIS contatos e nenhum casando, devolve nada — nome errado é pior que sem nome', () => {
    const nome = resolveContactProfileName({
      contacts: [contato('551111111111', 'A'), contato('552222222222', 'B')],
      from: '5516993056772',
    })

    expect(nome).toBeUndefined()
  })

  it('contato sem perfil não inventa nome', () => {
    expect(resolveContactProfileName({ contacts: [contato('5516993056772')], from: '5516993056772' })).toBeUndefined()
  })

  it('sem contatos, devolve nada', () => {
    expect(resolveContactProfileName({ contacts: undefined, from: '5516993056772' })).toBeUndefined()
    expect(resolveContactProfileName({ contacts: [], from: '5516993056772' })).toBeUndefined()
  })
})

describe('contatos no payload', () => {
  it('o schema do value passa a TIPAR contacts, em vez de deixar passar cru', () => {
    const parsed = whatsAppWebhookValueSchema.parse({
      messaging_product: 'whatsapp',
      contacts: [{ profile: { name: 'Joana Pereira' }, wa_id: '5516993056772' }],
      messages: [{ id: 'wamid.1', from: '5516993056772', type: 'text', timestamp: '1', text: { body: 'oi' } }],
    })

    expect(parsed.contacts?.[0]?.profile?.name).toBe('Joana Pereira')
  })

  it('payload SEM contacts continua válido — evento administrativo não traz contato', () => {
    expect(whatsAppWebhookValueSchema.safeParse({ messaging_product: 'whatsapp' }).success).toBe(true)
  })
})
