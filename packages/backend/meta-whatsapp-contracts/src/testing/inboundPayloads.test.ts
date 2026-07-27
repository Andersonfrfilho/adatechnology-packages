/**
 * O valor destes builders está inteiro na fidelidade: se o payload não passa pelo mesmo schema que
 * valida uma entrega real da Meta, o preview exercita um caminho que não existe.
 */

import { describe, expect, it } from 'bun:test'
import { whatsAppWebhookPayloadSchema } from '../webhook.types'
import {
  buildInboundAudioPayload,
  buildInboundInteractivePayload,
  buildInboundTextPayload,
  serializeWebhookPayload,
} from './inboundPayloads'

const FROM = '5511988887777'

function firstMessageOf(payload: unknown) {
  return whatsAppWebhookPayloadSchema.parse(payload).entry[0]?.changes[0]?.value.messages?.[0]
}

describe('builders de payload inbound', () => {
  it('produz texto que satisfaz o schema real da Cloud API', () => {
    const message = firstMessageOf(buildInboundTextPayload({ from: FROM, text: 'quero 2kg de arroz' }))

    expect(message?.from).toBe(FROM)
    expect(message?.text?.body).toBe('quero 2kg de arroz')
    expect(message?.id.startsWith('wamid.')).toBe(true)
  })

  it('produz resposta de botão e de lista no shape interativo', () => {
    const button = firstMessageOf(
      buildInboundInteractivePayload({ from: FROM, buttonReply: { id: 'confirmar', title: 'Confirmar' } }),
    )
    const list = firstMessageOf(
      buildInboundInteractivePayload({ from: FROM, listReply: { id: 'arroz-5kg', title: 'Arroz 5kg' } }),
    )

    expect(button?.interactive?.button_reply?.id).toBe('confirmar')
    expect(button?.interactive?.list_reply).toBeUndefined()
    expect(list?.interactive?.list_reply?.id).toBe('arroz-5kg')
    expect(list?.interactive?.button_reply).toBeUndefined()
  })

  it('produz áudio com o mime que o pipeline de STT espera', () => {
    const message = firstMessageOf(buildInboundAudioPayload({ from: FROM, mediaId: 'media-123' }))

    expect(message?.audio?.id).toBe('media-123')
    expect(message?.audio?.mime_type).toBe('audio/ogg; codecs=opus')
  })

  // Este é o invariante que impede o anti-replay do webhook de engolir a segunda mensagem: como a
  // assinatura é derivada do corpo, corpos iguais virariam o mesmo nonce.
  it('gera identificadores distintos para chamadas de mesmo conteúdo', () => {
    const first = firstMessageOf(buildInboundTextPayload({ from: FROM, text: 'sim' }))
    const second = firstMessageOf(buildInboundTextPayload({ from: FROM, text: 'sim' }))

    expect(first?.id).not.toBe(second?.id)
    expect(serializeWebhookPayload(buildInboundTextPayload({ from: FROM, text: 'sim' }))).not.toBe(
      serializeWebhookPayload(buildInboundTextPayload({ from: FROM, text: 'sim' })),
    )
  })
})
