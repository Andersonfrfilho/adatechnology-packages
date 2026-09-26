/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T303 (RF14, CA07): o threading RFC 5322 do canal e-mail. `In-Reply-To`/`References` vêm da
 * última mensagem **recebida** da conversa — sem ela, os dois campos ficam ausentes, nunca string
 * vazia. `Idempotency-Key` é o id da nossa própria mensagem (o mesmo id duas vezes é o mesmo
 * envio). `Message-ID` fora do formato esperado é ignorado, nunca entra cru no cabeçalho.
 * Vermelho até a T304 criar `emailThreading.ts`.
 */
import { describe, expect, it } from 'bun:test'

import { EMAIL_THREADING_REFERENCES_MAX_COUNT, buildEmailThreadingHeaders } from './emailThreading'

describe('buildEmailThreadingHeaders', () => {
  it('sem mensagem recebida anterior, In-Reply-To e References ficam ausentes (nunca string vazia)', () => {
    const headers = buildEmailThreadingHeaders({ messageId: 'our-message-1' })

    expect(headers).toEqual({ idempotencyKey: 'our-message-1' })
    expect('inReplyTo' in headers).toBe(false)
    expect('references' in headers).toBe(false)
  })

  it('In-Reply-To é o Message-ID da última mensagem recebida, e References leva o que ela trazia mais ela própria', () => {
    const headers = buildEmailThreadingHeaders({
      messageId: 'our-message-2',
      lastInboundMessage: {
        messageId: 'inbound-3@mail.example.com',
        references: ['inbound-1@mail.example.com', 'inbound-2@mail.example.com'],
      },
    })

    expect(headers.inReplyTo).toBe('inbound-3@mail.example.com')
    expect(headers.references).toEqual([
      'inbound-1@mail.example.com',
      'inbound-2@mail.example.com',
      'inbound-3@mail.example.com',
    ])
  })

  it('não duplica a última mensagem se ela já estava nas References que ela trazia', () => {
    const headers = buildEmailThreadingHeaders({
      messageId: 'our-message-3',
      lastInboundMessage: {
        messageId: 'inbound-2@mail.example.com',
        references: ['inbound-1@mail.example.com', 'inbound-2@mail.example.com'],
      },
    })

    expect(headers.references).toEqual(['inbound-1@mail.example.com', 'inbound-2@mail.example.com'])
  })

  it('Idempotency-Key é sempre o id da nossa mensagem — o mesmo id duas vezes é o mesmo envio', () => {
    const first = buildEmailThreadingHeaders({ messageId: 'same-id' })
    const second = buildEmailThreadingHeaders({ messageId: 'same-id' })

    expect(first.idempotencyKey).toBe('same-id')
    expect(second.idempotencyKey).toBe('same-id')
    expect(first.idempotencyKey).toBe(second.idempotencyKey)
  })

  it('Message-ID sem o formato local@domínio é ignorado — nunca entra cru no cabeçalho', () => {
    const headers = buildEmailThreadingHeaders({
      messageId: 'our-message-4',
      lastInboundMessage: { messageId: 'não é um message-id válido' },
    })

    expect(headers).toEqual({ idempotencyKey: 'our-message-4' })
  })

  it('aceita o Message-ID entre < > (forma comum no cabeçalho RFC 5322) e normaliza sem os sinais', () => {
    const headers = buildEmailThreadingHeaders({
      messageId: 'our-message-5',
      lastInboundMessage: { messageId: '<inbound-5@mail.example.com>' },
    })

    expect(headers.inReplyTo).toBe('inbound-5@mail.example.com')
    expect(headers.references).toEqual(['inbound-5@mail.example.com'])
  })

  it('References tem um teto: entradas mais antigas caem primeiro, a mensagem respondida nunca sai', () => {
    const longReferenceChain = Array.from(
      { length: EMAIL_THREADING_REFERENCES_MAX_COUNT + 10 },
      (_unused, index) => `inbound-${index}@mail.example.com`,
    )
    const headers = buildEmailThreadingHeaders({
      messageId: 'our-message-6',
      lastInboundMessage: { messageId: 'inbound-last@mail.example.com', references: longReferenceChain },
    })

    expect(headers.references).toHaveLength(EMAIL_THREADING_REFERENCES_MAX_COUNT)
    expect(headers.references?.at(-1)).toBe('inbound-last@mail.example.com')
    expect(headers.references?.[0]).toBe(
      `inbound-${longReferenceChain.length - (EMAIL_THREADING_REFERENCES_MAX_COUNT - 1)}@mail.example.com`,
    )
  })
})
