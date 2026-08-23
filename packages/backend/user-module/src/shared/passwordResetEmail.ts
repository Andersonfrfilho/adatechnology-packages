/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Texto padrão do e-mail de redefinição. Deliberadamente neutro — sem nome de produto, sem marca,
 * sem tom próprio: cinco produtos consomem este pacote, e copy é vocabulário do host. Serve para
 * o fluxo funcionar no primeiro boot; quem tem identidade a defender passa `passwordReset.buildEmail`.
 */

import type { PasswordResetEmailContent, PasswordResetEmailParams } from '@adatechnology/user-contracts'

const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

/**
 * O link vai para dentro de um atributo `href`: sem escapar, um `&` de query string quebra a URL
 * em cliente de e-mail que interpreta entidade HTML, e o token chega truncado.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function describeExpiry(expiresInSeconds: number): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / SECONDS_PER_MINUTE))
  if (minutes < MINUTES_PER_HOUR) return `${minutes} minuto${minutes === 1 ? '' : 's'}`

  const hours = Math.round(minutes / MINUTES_PER_HOUR)
  return `${hours} hora${hours === 1 ? '' : 's'}`
}

export function buildDefaultPasswordResetEmail(params: PasswordResetEmailParams): PasswordResetEmailContent {
  const validity = describeExpiry(params.expiresInSeconds)
  const safeUrl = escapeHtml(params.resetUrl)

  return {
    subject: 'Redefinição de senha',
    text: [
      `Olá, ${params.name}.`,
      '',
      'Recebemos um pedido para redefinir sua senha. Use o link abaixo:',
      params.resetUrl,
      '',
      `O link vale por ${validity} e só pode ser usado uma vez.`,
      'Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n'),
    html: [
      `<p>Olá, ${escapeHtml(params.name)}.</p>`,
      '<p>Recebemos um pedido para redefinir sua senha.</p>',
      `<p><a href="${safeUrl}">Redefinir senha</a></p>`,
      `<p>O link vale por ${validity} e só pode ser usado uma vez.</p>`,
      '<p>Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.</p>',
    ].join('\n'),
  }
}
