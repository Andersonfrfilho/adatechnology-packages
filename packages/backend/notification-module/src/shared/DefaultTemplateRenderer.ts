/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderer default: interpolação `{{campo}}` e nada mais. É a válvula de escape do host — quem
 * precisa de HTML rico, MJML ou i18n com plural forms injeta o próprio `TemplateRendererPort`.
 *
 * A implementação mudou de lugar, não de comportamento: a interpolação vive no `notification-contracts`
 * porque a tela de configuração precisa renderizar um preview, e o frontend não pode importar este
 * pacote (carrega Drizzle). Duas implementações da mesma interpolação divergiriam, e o preview
 * passaria a mentir sobre o que o cliente recebe.
 */

import { renderTemplate } from '@adatechnology/notification-contracts'
import type {
  RenderedTemplate,
  RenderTemplateParams,
  TemplateRendererPort,
} from '@adatechnology/notification-contracts'

export function renderDefaultTemplate(params: RenderTemplateParams): RenderedTemplate {
  return renderTemplate({
    channel: params.channel,
    subject: params.subject,
    body: params.body,
    payload: params.payload,
  })
}

export function createDefaultTemplateRenderer(): TemplateRendererPort {
  return { render: renderDefaultTemplate }
}
