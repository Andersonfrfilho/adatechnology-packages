/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A renderização default de template, pura e sem dependência.
 *
 * Mora no contracts, e não no módulo, por um motivo específico: a tela de configuração precisa
 * mostrar um PREVIEW do que o cliente vai receber, e o módulo carrega Drizzle — o frontend não pode
 * importá-lo. Reimplementar a interpolação no host resolveria hoje e divergiria amanhã, e **preview
 * que mente é pior que preview nenhum**: alguém salva o template confiando no que viu.
 *
 * Com a função aqui, o `notification-module` renderiza para enviar e a UI renderiza para mostrar,
 * lendo o MESMO código. Divergência deixa de ser possível em vez de ser improvável.
 */

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
const DEFAULT_TITLE_MAX_LENGTH = 120

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeTemplateHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character] ?? character)
}

/** `{{campo}}` → valor do payload. Campo ausente vira string vazia, nunca o literal `{{campo}}`. */
export function interpolateTemplate(template: string, payload: Readonly<Record<string, unknown>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = payload[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

export function deriveTitleFromBody(body: string): string {
  const firstLine = body.split('\n')[0] ?? ''
  return firstLine.length > DEFAULT_TITLE_MAX_LENGTH ? `${firstLine.slice(0, DEFAULT_TITLE_MAX_LENGTH)}…` : firstLine
}

/** Os nomes de campo que um template referencia — o que a tela de configuração precisa pedir. */
export function extractTemplatePlaceholders(template: string): readonly string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    if (match[1]) found.add(match[1])
  }
  return [...found]
}

export type RenderedTemplatePreview = {
  readonly title: string
  readonly body: string
  readonly html?: string
}

/**
 * Mesma saída que o envio produz. `channel` importa porque só e-mail ganha a versão HTML — mostrar
 * HTML no preview de WhatsApp faria a tela prometer formatação que o canal não tem.
 */
export function renderTemplate(params: {
  readonly channel: string
  readonly subject?: string | undefined
  readonly body: string
  readonly payload: Readonly<Record<string, unknown>>
}): RenderedTemplatePreview {
  const body = interpolateTemplate(params.body, params.payload)
  const title = params.subject ? interpolateTemplate(params.subject, params.payload) : deriveTitleFromBody(body)

  if (params.channel !== 'email') return { title, body }

  // Escapa o resultado já interpolado (texto do template e valores do payload juntos), depois troca
  // quebra de linha por <br> — quem quer HTML rico troca o renderer, em vez de descobrir por um bug
  // de escape.
  return { title, body, html: escapeTemplateHtml(body).replace(/\n/g, '<br>') }
}
