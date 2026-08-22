/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Único lugar que decide o valor de `company_id` usado para escopar leitura/escrita — nenhum
 * repositório ou caso de uso reimplementa esta decisão (`database.md`: filtro por tenant "por
 * construção", nunca por disciplina de quem chama).
 */

import { ConfigMissingError } from '@adatechnology/user-contracts'
import type { TenancyConfig } from '@adatechnology/user-contracts'

/**
 * Modo `single`: a linha nunca carrega `company_id` (fica `null`), então o escopo é sempre
 * `undefined` — o host não distingue empresas, e não faz sentido pedir uma.
 *
 * Modo `multi`: o chamador é obrigado a informar `companyId` explícito por chamada — vem do
 * `AuthContext` resolvido pelo host, nunca de um campo livre do cliente.
 */
export function resolveScopeCompanyId(params: {
  readonly tenancy: TenancyConfig
  readonly explicit?: string
}): string | undefined {
  if (params.tenancy.mode === 'single') return undefined
  if (!params.explicit) throw new ConfigMissingError('companyId')
  return params.explicit
}
