/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_RESTART_POLICY_TYPE = {
  NEVER: 'NEVER',
  ON_FAILURE: 'ON_FAILURE',
  ALWAYS: 'ALWAYS',
} as const
export type InfraRestartPolicyType = (typeof INFRA_RESTART_POLICY_TYPE)[keyof typeof INFRA_RESTART_POLICY_TYPE]

export const INFRA_RESTART_POLICY_KEY_PREFIX = 'infra:restart-policy:'

// Quem desligou precisa lembrar a política original por tempo de sobra até o próximo ligar.
export const INFRA_RESTART_POLICY_TTL_SECONDS = 90 * 24 * 60 * 60
