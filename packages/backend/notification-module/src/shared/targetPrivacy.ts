/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo nunca persiste e-mail nem telefone em claro (spec §5, LGPD `security.md` §1). Estas
 * duas funções são o único lugar onde o endereço real passa perto de uma coluna: uma vira hash
 * para permitir a busca de supressão, a outra vira uma máscara só para exibição.
 */

import { createHmac } from 'node:crypto'

/** HMAC, não hash simples — sem chave, qualquer um com acesso ao banco poderia rodar um
 * dicionário de e-mails/telefones comuns contra `target_hash` e confirmar quem está cadastrado. */
export function hashTarget(params: { readonly address: string; readonly key: string }): string {
  return createHmac('sha256', params.key).update(params.address).digest('hex')
}

export function maskTarget(address: string): string {
  const atIndex = address.indexOf('@')
  if (atIndex > 0) {
    const localPart = address.slice(0, atIndex)
    const visible = localPart.slice(0, 1)
    return `${visible}${'*'.repeat(Math.max(localPart.length - 1, 1))}@${address.slice(atIndex + 1)}`
  }

  const digitsOnly = address.replace(/\D/g, '')
  if (digitsOnly.length >= 4) return `****${digitsOnly.slice(-4)}`
  return '****'
}
