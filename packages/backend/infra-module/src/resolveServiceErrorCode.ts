/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraError } from '@adatechnology/infra-contracts'
import { INFRA_UNKNOWN_ERROR_CODE } from '@adatechnology/infra-contracts'

/** So o `code` estavel sai daqui: a mensagem de um erro inesperado pode carregar dado que nao deve ser gravado. */
export function resolveServiceErrorCode(error: unknown): string {
  return error instanceof InfraError ? error.code : INFRA_UNKNOWN_ERROR_CODE
}
