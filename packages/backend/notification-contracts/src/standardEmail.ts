/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O modelo padrão de e-mail (spec 274 T1.2, plan D3). Identidade (logo e nome), assinante e rodapé são marcação do
 * modelo, com variáveis; o texto vem escapado por valor e o HTML do sistema só por nome (conjunto fechado). Nenhuma
 * variável entra em atributo ou `style`. Puro: não envia — o transporte é do host.
 */

import {
  buildInitials,
  escapeEmailHtml,
  findUnsafeEmailHtml,
  htmlToPlainText,
  interpolateEmailHtml,
  renderEmailLogoHtml,
  renderEmailMarksHtml,
  STANDARD_EMAIL_THEME,
} from './emailHtml'
import type { EmailLogo, UnsafeEmailHtmlRule } from './emailHtml'
import { extractTemplatePlaceholders } from './templateRender'
import type { TemplateVariableDefinition } from './templateVariables'
import { STANDARD_EMAIL_PT_BR_HTML } from './templates/standardEmailTemplate.generated'

const { copper, ink, mist, rule, slate } = STANDARD_EMAIL_THEME.colors
const FONT = STANDARD_EMAIL_THEME.font

export const STANDARD_EMAIL_TEMPLATE_KEY = 'notification.standard-email'
export const STANDARD_EMAIL_CHANNEL = 'email'
export const STANDARD_EMAIL_LOCALE = 'pt-BR'

/** O HTML passa de tantos bytes UTF-8: problema do modelo, não erro 500. */
export const STANDARD_EMAIL_HTML_MAX_BYTES = 524288

/** HTML do sistema, decidido pelo nome: o sistema o monta e escapa o que ele carrega. */
export const STANDARD_EMAIL_SYSTEM_HTML_VARIABLES = [
  'logoEmpresa',
  'corpoMensagem',
  'listaAnexos',
  'faixaResposta',
  'marcasRodape',
] as const
export type StandardEmailSystemHtmlVariable = (typeof STANDARD_EMAIL_SYSTEM_HTML_VARIABLES)[number]

/** Identidade, assinante, rodapé e corpo: um modelo sem uma delas não é utilizável. */
export const STANDARD_EMAIL_REQUIRED_VARIABLES = [
  'corpoMensagem',
  'logoEmpresa',
  'nomeEmpresa',
  'nomeAssinante',
  'rodapePlataforma',
  'marcasRodape',
] as const

export const STANDARD_EMAIL_VARIABLES: readonly TemplateVariableDefinition[] = [
  { name: 'nomeEmpresa', example: 'Alfa Transportes', required: true },
  { name: 'logoEmpresa', example: '(logo ou iniciais da empresa)', required: true },
  { name: 'corpoMensagem', example: 'Olá, segue a nota fiscal.', required: true },
  { name: 'listaAnexos', example: 'nota-1234.pdf', required: false },
  { name: 'faixaResposta', example: 'Responda este e-mail.', required: false },
  { name: 'iniciaisAssinante', example: 'MS', required: false },
  { name: 'nomeAssinante', example: 'Maria da Silva', required: true },
  { name: 'cargoAssinante', example: 'Analista de logística', required: false },
  { name: 'rodapePlataforma', example: 'Enviado pelo TransportAdA — uma solução Ada Technology', required: true },
  { name: 'marcasRodape', example: '(marcas do produto e da plataforma)', required: true },
]

/** O modelo, com a procedência que a resposta devolve: `builtin` é a rede de segurança (versão `0`). */
export type StandardEmailTemplate = {
  readonly html: string
  readonly source: 'builtin' | 'company'
  readonly version: number
}

export const STANDARD_EMAIL_BUILTIN_TEMPLATE: StandardEmailTemplate = {
  html: STANDARD_EMAIL_PT_BR_HTML,
  source: 'builtin',
  version: 0,
}

/** Só texto: nenhum HTML entra aqui. */
export type StandardEmailInput = {
  readonly attachments: readonly { readonly name: string }[]
  readonly bodyText: string
  readonly footer: {
    readonly platformMarkUrl?: string | undefined
    readonly platformNote: string
    readonly productMarkUrl?: string | undefined
  }
  readonly identity: { readonly displayName: string; readonly logo: EmailLogo }
  readonly replyHint?: string | undefined
  readonly signer: { readonly name: string; readonly role?: string | undefined }
  /** Valores extras para modelos da empresa que os usem; nunca sobrescrevem as variáveis do sistema. */
  readonly values?: Readonly<Record<string, string>> | undefined
}

export type RenderedStandardEmail = {
  readonly bytes: number
  readonly html: string
  readonly template: {
    readonly key: typeof STANDARD_EMAIL_TEMPLATE_KEY
    readonly source: StandardEmailTemplate['source']
    readonly version: number
  }
  readonly text: string
  readonly tooLarge: boolean
}

export type StandardEmailAssessment = {
  /** Obrigatórias que o modelo não usa. */
  readonly missing: readonly (typeof STANDARD_EMAIL_REQUIRED_VARIABLES)[number][]
  readonly unsafe: readonly UnsafeEmailHtmlRule[]
  readonly usable: boolean
}

/** Utilizável = HTML seguro e todas as obrigatórias presentes. Inutilizável nunca é enviado. */
export function assessStandardEmailTemplate(html: string): StandardEmailAssessment {
  const used = new Set(extractTemplatePlaceholders(html))
  const missing = STANDARD_EMAIL_REQUIRED_VARIABLES.filter((name) => !used.has(name))
  const unsafe = findUnsafeEmailHtml(html)
  return { missing, unsafe, usable: missing.length === 0 && unsafe.length === 0 }
}

const PARAGRAPH_BREAK = /(?:\r\n|\r|\n)[^\S\r\n]*(?:(?:\r\n|\r|\n)[^\S\r\n]*)+/u
const NEWLINE = /\r\n|\r|\n/gu

/** Linha em branco → parágrafo; quebra simples → `<br>`. Tudo escapado. */
function buildMessageBody(bodyText: string): string {
  return bodyText
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) => `<p style="margin:0 0 14px">${escapeEmailHtml(paragraph).replace(NEWLINE, '<br>')}</p>`)
    .join('')
}

function buildAttachmentList(attachments: readonly { readonly name: string }[]): string {
  if (attachments.length === 0) return ''
  const rows = attachments
    .map(
      (attachment) =>
        `<tr><td style="padding:4px 0;border-bottom:1px solid ${rule};font:13px ${FONT};color:${ink}">${escapeEmailHtml(attachment.name)}</td></tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 4px;font:700 11px ${FONT};text-transform:uppercase;color:${slate}">Anexos</td></tr>${rows}</table>`
}

function buildReplyStrip(replyHint: string | undefined): string {
  if (replyHint === undefined || replyHint.trim() === '') return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:10px 14px;background:${mist};border-left:3px solid ${copper};font-family:${FONT};font-size:12px;color:${ink}">${escapeEmailHtml(replyHint)}</td></tr></table>`
}

export function renderStandardEmail(params: {
  readonly input: StandardEmailInput
  readonly template: StandardEmailTemplate
}): RenderedStandardEmail {
  const { input, template } = params
  const { attachments, bodyText, footer, identity, replyHint, signer, values } = input
  const html = interpolateEmailHtml({
    systemHtml: {
      corpoMensagem: buildMessageBody(bodyText),
      faixaResposta: buildReplyStrip(replyHint),
      listaAnexos: buildAttachmentList(attachments),
      logoEmpresa: renderEmailLogoHtml({ displayName: identity.displayName, logo: identity.logo }),
      marcasRodape: renderEmailMarksHtml({
        platformMarkUrl: footer.platformMarkUrl,
        productMarkUrl: footer.productMarkUrl,
      }),
    } satisfies Record<StandardEmailSystemHtmlVariable, string>,
    systemHtmlNames: STANDARD_EMAIL_SYSTEM_HTML_VARIABLES,
    template: template.html,
    values: {
      ...values,
      cargoAssinante: signer.role ?? '',
      iniciaisAssinante: buildInitials(signer.name),
      nomeAssinante: signer.name,
      nomeEmpresa: identity.displayName,
      rodapePlataforma: footer.platformNote,
    },
  })
  const bytes = new TextEncoder().encode(html).length
  return {
    bytes,
    html,
    template: { key: STANDARD_EMAIL_TEMPLATE_KEY, source: template.source, version: template.version },
    text: htmlToPlainText(html),
    tooLarge: bytes > STANDARD_EMAIL_HTML_MAX_BYTES,
  }
}
