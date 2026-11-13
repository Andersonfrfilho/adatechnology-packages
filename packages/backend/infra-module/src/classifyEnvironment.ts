/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_ENVIRONMENT_CLASSIFICATION } from '@adatechnology/infra-contracts'
import type { ClassifyEnvironmentParams, ClassifyEnvironmentResult } from '@adatechnology/infra-contracts'

// 'prod' cobre production e abreviações; falhar para o lado seguro é melhor que desligar produção por nome fora do padrão.
const PRODUCTION_MARKER = 'prod'

export function isProductionEnvironmentName(environmentName: string): boolean {
  return environmentName.toLowerCase().includes(PRODUCTION_MARKER)
}

export function classifyEnvironment(params: ClassifyEnvironmentParams): ClassifyEnvironmentResult {
  const { environmentName, environmentId, managedPattern, selfEnvironmentId } = params

  if (isProductionEnvironmentName(environmentName)) return INFRA_ENVIRONMENT_CLASSIFICATION.PROTECTED
  // Id vazio nunca casa: sem RAILWAY_ENVIRONMENT_ID não existe proteção por id.
  if (selfEnvironmentId !== '' && selfEnvironmentId === environmentId) {
    return INFRA_ENVIRONMENT_CLASSIFICATION.PROTECTED
  }
  if (new RegExp(managedPattern, 'i').test(environmentName)) return INFRA_ENVIRONMENT_CLASSIFICATION.MANAGED
  return INFRA_ENVIRONMENT_CLASSIFICATION.UNMANAGED
}
