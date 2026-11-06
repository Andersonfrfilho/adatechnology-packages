/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O ÚNICO lugar que decide o `company_id` usado para escopar leitura e escrita.
 */

import { ConfigInvalidError, type TenancyConfig } from '@adatechnology/recommendation-contracts'

/**
 * `single`: a linha nunca carrega `company_id`. `multi`: o chamador é OBRIGADO a informar, e o
 * valor vem do contexto autenticado — nunca do corpo, que deixaria escolher de qual empresa ler.
 */
export function resolveScopeCompanyId(params: {
  readonly tenancy: TenancyConfig
  readonly explicit?: string
}): string | undefined {
  if (params.tenancy.mode === 'single') return undefined
  if (!params.explicit) throw new ConfigInvalidError('companyId é obrigatório no modo multi-tenant.')
  return params.explicit
}
