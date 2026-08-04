/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderer default: interpolação `{{campo}}` e nada mais. É a válvula de escape do host: quem
 * precisa de HTML rico, MJML ou i18n com plural forms injeta o próprio `TemplateRendererPort` —
 * este arquivo cobre o caso comum (template em texto simples) sem forçar dependência nenhuma.
 */

import type {
  RenderedTemplate,
  RenderTemplateParams,
  TemplateRendererPort,
} from '@adatechnology/notification-contracts'
import { NOTIFICATION_CHANNEL } from '@adatechnology/notification-contracts'

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
const DEFAULT_TITLE_MAX_LENGTH = 120

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character] ?? character)
}

function interpolate(template: string, payload: Readonly<Record<string, unknown>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = payload[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function deriveTitleFromBody(body: string): string {
  const firstLine = body.split('\n')[0] ?? ''
  return firstLine.length > DEFAULT_TITLE_MAX_LENGTH ? `${firstLine.slice(0, DEFAULT_TITLE_MAX_LENGTH)}…` : firstLine
}

export function renderDefaultTemplate(params: RenderTemplateParams): RenderedTemplate {
  const body = interpolate(params.body, params.payload)
  const title = params.subject ? interpolate(params.subject, params.payload) : deriveTitleFromBody(body)

  if (params.channel !== NOTIFICATION_CHANNEL.EMAIL) return { title, body }

  // E-mail ganha uma versão HTML derivada: escapa o resultado já interpolado (texto do template
  // e valores do payload juntos), depois troca quebra de linha por <br> — assim quem quer HTML
  // rico de verdade sabe que precisa trocar o renderer, em vez de descobrir por um bug de escape.
  const html = escapeHtml(body).replace(/\n/g, '<br>')
  return { title, body, html }
}

export function createDefaultTemplateRenderer(): TemplateRendererPort {
  return { render: renderDefaultTemplate }
}
