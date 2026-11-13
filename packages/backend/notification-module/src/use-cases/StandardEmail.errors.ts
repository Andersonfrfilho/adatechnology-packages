/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { NotificationError } from '@adatechnology/notification-contracts'

/** Prefixo próprio: a chave padrão tem recusas que nenhuma outra chave tem. */
export const STANDARD_EMAIL_ERROR_CODES = {
  INVALID: 'NOTIFICATION_STANDARD_EMAIL_TEMPLATE_INVALID',
  REQUIRED: 'NOTIFICATION_STANDARD_EMAIL_TEMPLATE_REQUIRED',
} as const

/**
 * O HTML gravado para o modelo padrão não é utilizável: falta variável obrigatória ou há marcação
 * insegura. `details` nomeia tudo de uma vez (corrigir uma por vez vira tentativa e erro) e
 * nunca carrega o HTML.
 */
export class StandardEmailTemplateInvalidError extends NotificationError {
  constructor(
    public readonly missing: readonly string[],
    public readonly unsafe: readonly string[],
  ) {
    super(
      'O modelo padrão de e-mail não é utilizável: faltam variáveis obrigatórias ou há HTML inseguro.',
      400,
      STANDARD_EMAIL_ERROR_CODES.INVALID,
      { missing: [...missing], unsafe: [...unsafe] },
    )
  }
}

/** O modelo padrão não pode ser removido nem desativado: o envio do chat depende dele. */
export class StandardEmailTemplateRequiredError extends NotificationError {
  constructor() {
    super(
      'O modelo padrão de e-mail é do sistema e não pode ser removido. Use "Restaurar padrão" para voltar ao original.',
      409,
      STANDARD_EMAIL_ERROR_CODES.REQUIRED,
    )
  }
}
