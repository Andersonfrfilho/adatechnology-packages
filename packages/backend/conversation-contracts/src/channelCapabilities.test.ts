/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF2, D3, D4: a tabela de capacidades é o que faz a tela não mentir — recurso que o canal não tem
 * aparece desabilitado com dica, nunca escondido sem explicação. Os valores vêm do `plan.md` § Fase
 * 1 e da política de origem (183): `message-status.policy.ts` (o que cada canal alcança) e
 * `conversation-attachment.policy.ts` (o teto de anexo por canal).
 *
 * `attachments.maxBytes` é o teto do maior tipo aceito no canal (o que a política de origem chama
 * de `CONVERSATION_ATTACHMENT_LIMITS[canal][tipo]`, tomado no maior tipo) — o contrato não abre por
 * tipo de anexo, só por canal. `webchat` não tem política de origem (é o único canal que nasce
 * aqui, spec 211): seu teto é o menor entre os tetos dos outros canais, como o enunciado da task
 * pede, e ele não confirma leitura nem áudio, então alcança só `queued | delivered | failed` — o
 * mesmo formato de `app` (sem `sent`, porque não tem fila de provedor) trocando `read` por `failed`
 * (não confirma leitura, mas o transporte pode falhar).
 */
import { describe, expect, it } from 'bun:test'

import { CONVERSATION_CHANNEL } from './vocabulary'
import { CHANNEL_CAPABILITIES, getChannelCapabilities } from './channelCapabilities'

const MB = 1024 * 1024

describe('tabela de capacidades por canal', () => {
  it('cobre exatamente os canais do vocabulário', () => {
    expect(Object.keys(CHANNEL_CAPABILITIES).sort()).toEqual([...CONVERSATION_CHANNEL].sort())
  })

  it('está congelada, inclusive os objetos internos', () => {
    expect(Object.isFrozen(CHANNEL_CAPABILITIES)).toBe(true)
    for (const channel of CONVERSATION_CHANNEL) {
      const capabilities = CHANNEL_CAPABILITIES[channel]
      expect(Object.isFrozen(capabilities)).toBe(true)
      expect(Object.isFrozen(capabilities.attachments)).toBe(true)
      expect(Object.isFrozen(capabilities.audio)).toBe(true)
    }
  })

  it('e-mail não confirma leitura, tem transporte próprio e nunca alcança read (D4, D5)', () => {
    const email = CHANNEL_CAPABILITIES.email
    expect(email.confirmsRead).toBe(false)
    expect(email.sessionWindowHours).toBeNull()
    expect(email.requiresTransport).toBe(true)
    expect(email.reachableStatuses).toEqual(['queued', 'sent', 'delivered', 'failed', 'bounced'])
    expect(email.reachableStatuses).not.toContain('read')
    expect(email.attachments).toEqual({ accepted: true, maxBytes: 10 * MB, maxTotalBytes: 25 * MB })
    expect(email.audio).toEqual({ plays: true, records: true })
    expect(email.quickReplies).toBe(true)
  })

  it('whatsapp confirma leitura e tem janela de 24h', () => {
    const whatsapp = CHANNEL_CAPABILITIES.whatsapp
    expect(whatsapp.confirmsRead).toBe(true)
    expect(whatsapp.sessionWindowHours).toBe(24)
    expect(whatsapp.requiresTransport).toBe(false)
    expect(whatsapp.reachableStatuses).toEqual(['queued', 'sent', 'delivered', 'read', 'failed'])
    expect(whatsapp.attachments).toEqual({
      accepted: true,
      maxBytes: 100 * MB,
      maxTotalBytes: null,
    })
    expect(whatsapp.audio).toEqual({ plays: true, records: true })
  })

  it('app confirma leitura', () => {
    const app = CHANNEL_CAPABILITIES.app
    expect(app.confirmsRead).toBe(true)
    expect(app.sessionWindowHours).toBeNull()
    expect(app.requiresTransport).toBe(false)
    expect(app.reachableStatuses).toEqual(['queued', 'delivered', 'read'])
    expect(app.attachments).toEqual({ accepted: true, maxBytes: 25 * MB, maxTotalBytes: null })
    expect(app.audio).toEqual({ plays: true, records: true })
  })

  it('portal confirma leitura, ouve áudio e não grava (Permissions-Policy nega o microfone)', () => {
    const portal = CHANNEL_CAPABILITIES.portal
    expect(portal.confirmsRead).toBe(true)
    expect(portal.sessionWindowHours).toBeNull()
    expect(portal.requiresTransport).toBe(false)
    expect(portal.reachableStatuses).toEqual(['delivered', 'read'])
    expect(portal.reachableStatuses).not.toContain('sent')
    expect(portal.attachments).toEqual({ accepted: true, maxBytes: 25 * MB, maxTotalBytes: null })
    expect(portal.audio).toEqual({ plays: true, records: false })
  })

  it('webchat não confirma leitura e não tem áudio, com o menor teto de anexo dos outros canais', () => {
    const webchat = CHANNEL_CAPABILITIES.webchat
    expect(webchat.confirmsRead).toBe(false)
    expect(webchat.sessionWindowHours).toBeNull()
    expect(webchat.requiresTransport).toBe(false)
    expect(webchat.attachments.maxBytes).toBe(
      Math.min(
        CHANNEL_CAPABILITIES.email.attachments.maxBytes,
        CHANNEL_CAPABILITIES.whatsapp.attachments.maxBytes,
        CHANNEL_CAPABILITIES.app.attachments.maxBytes,
        CHANNEL_CAPABILITIES.portal.attachments.maxBytes,
      ),
    )
    expect(webchat.attachments.maxTotalBytes).toBeNull()
    expect(webchat.audio).toEqual({ plays: false, records: false })
  })

  it('getChannelCapabilities devolve a mesma linha da tabela', () => {
    for (const channel of CONVERSATION_CHANNEL) {
      expect(getChannelCapabilities(channel)).toEqual(CHANNEL_CAPABILITIES[channel])
    }
  })
})
