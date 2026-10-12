/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RailwayInfraError } from '@adatechnology/railway-infra-contracts'
import { RAILWAY_INFRA_UNKNOWN_ERROR_CODE } from '@adatechnology/railway-infra-contracts'

/** So o `code` estavel sai daqui: a mensagem de um erro inesperado pode carregar dado que nao deve ser gravado. */
export function resolveServiceErrorCode(error: unknown): string {
  return error instanceof RailwayInfraError ? error.code : RAILWAY_INFRA_UNKNOWN_ERROR_CODE
}
