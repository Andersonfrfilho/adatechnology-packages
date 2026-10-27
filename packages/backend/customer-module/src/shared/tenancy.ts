/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O ÚNICO lugar que decide o `company_id` usado para escopar leitura e escrita.
 *
 * Nenhum repositório reimplementa esta decisão: `database.md` manda filtrar tenant por construção,
 * nunca por disciplina de quem chama.
 */

import { ConfigMissingError } from './errors'
import type { TenancyConfig } from '@adatechnology/customer-contracts'

/**
 * Modo `single`: a linha nunca carrega `company_id`, e o escopo é sempre `undefined`.
 *
 * Modo `multi`: o chamador é OBRIGADO a informar. Ele vem do contexto autenticado, nunca de um
 * campo livre do cliente — aceitar do corpo seria deixar escolher de qual empresa ler.
 */
export function resolveScopeCompanyId(params: {
  readonly tenancy: TenancyConfig
  readonly explicit?: string
}): string | undefined {
  if (params.tenancy.mode === 'single') return undefined
  if (!params.explicit) throw new ConfigMissingError('companyId é obrigatório no modo multi-tenant.')
  return params.explicit
}
