/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Texto padrão neutro do e-mail de confirmação do endereço novo (copy é do host: `emailChange.buildEmail`).
 */

import type { EmailChangeEmailParams, PasswordResetEmailContent } from '@adatechnology/user-contracts'

const HOURS = 3600

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildDefaultEmailChangeEmail(params: EmailChangeEmailParams): PasswordResetEmailContent {
  const hours = Math.max(1, Math.round(params.expiresInSeconds / HOURS))
  return {
    subject: 'Confirme seu novo e-mail',
    text: [
      `Olá, ${params.name}.`,
      '',
      'Confirme que este endereço é seu para usá-lo na conta:',
      params.confirmUrl,
      '',
      `O link vale por ${hours} hora${hours === 1 ? '' : 's'} e só pode ser usado uma vez.`,
      'Se não foi você quem pediu, ignore esta mensagem.',
    ].join('\n'),
    html: [
      `<p>Olá, ${escapeHtml(params.name)}.</p>`,
      '<p>Confirme que este endereço é seu para usá-lo na conta.</p>',
      `<p><a href="${escapeHtml(params.confirmUrl)}">Confirmar novo e-mail</a></p>`,
      `<p>O link vale por ${hours} hora${hours === 1 ? '' : 's'} e só pode ser usado uma vez.</p>`,
      '<p>Se não foi você quem pediu, ignore esta mensagem.</p>',
    ].join('\n'),
  }
}
