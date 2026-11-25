/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que a mensagem do cliente oferece como resposta. Toque em botão/lista é `reply` (o id é
 * confiável); texto e botão de template são `text` (passam por casamento de rótulo); áudio, imagem,
 * localização e afins são `unsupported` — o runner avisa e repergunta sem contar tentativa.
 */

import type { WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'

export type FlowInbound =
  | { readonly kind: 'reply'; readonly answer: string }
  | { readonly kind: 'text'; readonly answer: string }
  | { readonly kind: 'unsupported' }

export function readFlowInbound(message: WhatsAppMessage): FlowInbound {
  const reply = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id
  if (reply !== undefined) return { kind: 'reply', answer: reply }
  if (message.text?.body !== undefined) return { kind: 'text', answer: message.text.body }
  // Botão de resposta rápida de template: o texto do botão, que casa com o rótulo da opção.
  if (message.button?.text !== undefined) return { kind: 'text', answer: message.button.text }
  return { kind: 'unsupported' }
}
