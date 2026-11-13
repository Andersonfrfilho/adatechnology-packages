/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Provedores de infraestrutura que o módulo sabe falar. Um driver novo (AWS, por exemplo) entra aqui,
 * implementa `InfraGatewayInterface` e é registrado em `createInfraGateway`.
 */
export const INFRA_DRIVER = {
  RAILWAY: 'railway',
} as const
export type InfraDriver = (typeof INFRA_DRIVER)[keyof typeof INFRA_DRIVER]
