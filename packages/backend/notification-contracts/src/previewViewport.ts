/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Larguras e limites do preview, por canal.
 *
 * Moram aqui, e não no CSS da UI, porque o host que consome a camada headless precisa deles para
 * desenhar o próprio preview — e porque o limite de caracteres não é decoração de tela: ele é a
 * regra do canal, e o editor avisa com ela antes de salvar.
 */

import { NOTIFICATION_CHANNEL } from './notification.types'
import type { NotificationChannel } from './notification.types'

export const PREVIEW_VIEWPORT = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
} as const
export type PreviewViewport = (typeof PREVIEW_VIEWPORT)[keyof typeof PREVIEW_VIEWPORT]

export type PreviewViewportSpec = {
  readonly viewport: PreviewViewport
  readonly width: number
}

const MOBILE: PreviewViewportSpec = { viewport: PREVIEW_VIEWPORT.MOBILE, width: 375 }

/**
 * `email` em 600px é a largura clássica de corpo de e-mail; os demais aproximam o container em que
 * a mensagem aparece no desktop. `sms` não tem desktop — a mensagem é a mesma no aparelho e ponto.
 */
export const PREVIEW_VIEWPORT_BY_CHANNEL: Readonly<Record<NotificationChannel, readonly PreviewViewportSpec[]>> = {
  /** O unico canal lido nos dois lugares — e o assunto corta diferente em cada um. */
  [NOTIFICATION_CHANNEL.EMAIL]: [{ viewport: PREVIEW_VIEWPORT.DESKTOP, width: 600 }, MOBILE],
  /**
   * Push, WhatsApp e SMS sao de aparelho. Um quadro largo ao lado sugeriria uma leitura em tela
   * grande que nao existe — e o corte que importa (duas linhas no push, 160 caracteres no SMS)
   * so acontece no celular.
   */
  [NOTIFICATION_CHANNEL.PUSH]: [MOBILE],
  [NOTIFICATION_CHANNEL.WHATSAPP]: [MOBILE],
  [NOTIFICATION_CHANNEL.SMS]: [MOBILE],
  /** Inbox e a tela do proprio produto, que e de computador neste ecossistema. */
  [NOTIFICATION_CHANNEL.INBOX]: [{ viewport: PREVIEW_VIEWPORT.DESKTOP, width: 480 }],
}

export type TemplateConstraintField = 'title' | 'body'

export type TemplateConstraintLimits = {
  readonly title?: number
  readonly body?: number
}

/**
 * Onde o canal corta de verdade. `email.title` são os ~78 caracteres que a lista da caixa de
 * entrada mostra no celular; `push` segue o teto prático do Android; `sms` é o segmento de 160,
 * depois do qual a operadora cobra outra mensagem; `whatsapp.body` é o teto de corpo de template
 * da Meta. `inbox` acompanha o `deriveTitleFromBody`.
 */
export const TEMPLATE_CONSTRAINTS_BY_CHANNEL: Readonly<Record<NotificationChannel, TemplateConstraintLimits>> = {
  [NOTIFICATION_CHANNEL.EMAIL]: { title: 78 },
  [NOTIFICATION_CHANNEL.PUSH]: { title: 65, body: 240 },
  [NOTIFICATION_CHANNEL.WHATSAPP]: { body: 1024 },
  [NOTIFICATION_CHANNEL.INBOX]: { title: 120 },
  [NOTIFICATION_CHANNEL.SMS]: { body: 160 },
}
