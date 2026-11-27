/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Marca de ambiente de e-mail: fora de produção a mensagem sai com o assunto prefixado, uma faixa no topo do corpo HTML
 * e a primeira linha do texto avisando que é teste. Pura e idempotente (reenvio nunca duplica a marca); o host chama a
 * MESMA função no envio e na prévia, para a prévia ser exatamente o que sai. Tabela e estilo inline: é HTML de e-mail.
 */

import { escapeEmailHtml } from './emailHtml'

export type EmailEnvironmentMark = {
  /** Prefixo do assunto, com o espaço final (`"[Teste] "`). */
  readonly subjectPrefix: string
  /** Texto da faixa e da primeira linha do texto simples. */
  readonly bannerText: string
  /** Fundo da faixa; padrão âmbar claro. */
  readonly bannerBackground?: string
  /** Cor do texto da faixa; padrão âmbar escuro. */
  readonly bannerColor?: string
  /** Borda inferior da faixa; padrão âmbar. */
  readonly bannerBorder?: string
}

export type MarkableEmail = { readonly subject: string; readonly html: string; readonly text: string }

const BANNER_ATTRIBUTE = 'data-environment-banner'
const BODY_OPEN_PATTERN = /<body\b[^>]*>/i
const DEFAULT_BACKGROUND = '#fff1c2'
const DEFAULT_COLOR = '#5c3d00'
const DEFAULT_BORDER = '#e6c866'
const FONT = 'Arial,Helvetica,sans-serif'

export function buildEnvironmentBannerHtml(mark: EmailEnvironmentMark): string {
  const background = mark.bannerBackground ?? DEFAULT_BACKGROUND
  const color = mark.bannerColor ?? DEFAULT_COLOR
  const border = mark.bannerBorder ?? DEFAULT_BORDER
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${BANNER_ATTRIBUTE}="true"><tr>` +
    `<td align="center" style="padding:8px 12px;background:${background};color:${color};border-bottom:1px solid ${border};` +
    `font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;text-align:center;">${escapeEmailHtml(mark.bannerText)}</td>` +
    '</tr></table>'
  )
}

function markHtml(html: string, mark: EmailEnvironmentMark): string {
  if (html.includes(BANNER_ATTRIBUTE)) return html
  const banner = buildEnvironmentBannerHtml(mark)
  const bodyOpen = BODY_OPEN_PATTERN.exec(html)
  if (!bodyOpen) return banner + html
  const insertAt = bodyOpen.index + bodyOpen[0].length
  return html.slice(0, insertAt) + banner + html.slice(insertAt)
}

export function markEmailForEnvironment<TEmail extends MarkableEmail>(
  message: TEmail,
  mark: EmailEnvironmentMark,
): TEmail {
  const bannerLine = `[${mark.bannerText}]`
  return {
    ...message,
    subject: message.subject.startsWith(mark.subjectPrefix) ? message.subject : mark.subjectPrefix + message.subject,
    html: markHtml(message.html, mark),
    text: message.text.startsWith(bannerLine) ? message.text : `${bannerLine}\n\n${message.text}`,
  }
}
