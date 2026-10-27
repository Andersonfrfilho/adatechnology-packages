/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Monta a mensagem MIME crua.
 *
 * Existe por causa do SES: o `SendEmail` do SESv2 so aceita `Simple` — assunto, HTML e texto — e
 * nao tem campo de anexo. Com anexo a unica saida e `Raw`, e ai o MIME inteiro e responsabilidade
 * de quem chama. Nodemailer e Resend montam sozinhos; a AWS nao.
 *
 * A estrutura e a canonica de e-mail com anexo:
 *
 *   multipart/mixed
 *     multipart/alternative      <- as duas versoes do MESMO conteudo
 *       text/plain
 *       text/html
 *     application/pdf            <- os anexos, irmaos do conteudo
 *
 * Aninhar o `alternative` dentro do `mixed` nao e detalhe: no mesmo nivel, o cliente trataria o
 * anexo como uma terceira "versao alternativa" do corpo e poderia exibi-lo NO LUGAR do texto.
 */

import type { FetchedAttachment } from './fetchAttachments'

export type BuildMimeMessageParams = {
  readonly from: string
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string | undefined
  readonly attachments: readonly FetchedAttachment[]
}

const CRLF = '\r\n'

/** 76 caracteres e o limite de linha do base64 em MIME (RFC 2045). */
const BASE64_LINE = 76

export function buildMimeMessage(params: BuildMimeMessageParams): Uint8Array {
  const mixed = newBoundary('mixed')
  const alternative = newBoundary('alt')

  const lines: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    ...(params.replyTo ? [`Reply-To: ${params.replyTo}`] : []),
    `Subject: ${encodeHeaderValue(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    '',
    `--${alternative}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(new TextEncoder().encode(params.text)),
    `--${alternative}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(new TextEncoder().encode(params.html)),
    `--${alternative}--`,
    '',
  ]

  for (const attachment of params.attachments) {
    lines.push(
      `--${mixed}`,
      `Content-Type: ${attachment.contentType}; name="${escapeQuoted(attachment.filename)}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${escapeQuoted(attachment.filename)}"`,
      '',
      encodeBase64Lines(attachment.content),
    )
  }

  lines.push(`--${mixed}--`, '')

  return new TextEncoder().encode(lines.join(CRLF))
}

/**
 * Corpo e anexo vao em base64, inclusive o texto.
 *
 * Alternativa seria `quoted-printable` para o texto, que e legivel na fonte — e que obriga a
 * escapar `=`, cortar em 76 colunas sem partir caractere multibyte e tratar espaco no fim da linha.
 * Base64 nao tem nenhuma dessas armadilhas, e acento em portugues nao sobrevive a `7bit`.
 */
function encodeBase64Lines(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64')
  const lines: string[] = []

  for (let index = 0; index < base64.length; index += BASE64_LINE) {
    lines.push(base64.slice(index, index + BASE64_LINE))
  }

  return lines.join(CRLF) + CRLF
}

/**
 * Assunto com acento nao pode ir cru: cabecalho e ASCII por definicao (RFC 5322), e um "Confirmacao"
 * com cedilha chega como byte quebrado. `=?UTF-8?B?...?=` e a codificacao de palavra do RFC 2047.
 *
 * Assunto ASCII puro fica como esta — codificar tudo esconderia o texto de quem le a fonte sem
 * ganhar nada.
 */
function encodeHeaderValue(value: string): string {
  if (!/[^ -~]/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/**
 * Aspas e barra dentro do nome do arquivo fechariam o parametro do cabecalho e o resto do nome
 * viraria diretiva MIME. O contrato ja recusa caminho no nome; isto e a segunda camada.
 */
function escapeQuoted(value: string): string {
  return value.replace(/["\\]/g, '')
}

/**
 * O boundary precisa ser impossivel de aparecer no conteudo: se aparecer, o cliente corta a
 * mensagem no meio do anexo. Aleatorio resolve, e o prefixo so ajuda a ler a fonte.
 */
function newBoundary(prefix: string): string {
  return `ada-${prefix}-${crypto.randomUUID()}`
}
