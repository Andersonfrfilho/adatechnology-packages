import { z } from 'zod'

import { KEYCLOAK_ADMIN_ERROR_CODE } from './keycloak-admin.constant.js'
import { KeycloakAdminError } from './keycloak-admin.error.js'
import type { KeycloakAdminConfig } from './keycloak-admin.types.js'

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const keycloakAdminConfigSchema = z.object({
  baseUrl: z.string().min(1).refine(isAbsoluteHttpUrl, { message: 'must be an absolute http(s) URL' }),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  realm: z.string().min(1),
})

/**
 * A falha carrega só o caminho do campo inválido. O valor nunca entra — seria o `clientSecret`.
 */
export function parseKeycloakAdminConfig(value: unknown): KeycloakAdminConfig {
  const parsed = keycloakAdminConfigSchema.safeParse(value)

  if (parsed.success) return parsed.data

  throw new KeycloakAdminError({
    code: KEYCLOAK_ADMIN_ERROR_CODE.CONFIGURATION_INVALID,
    context: { fields: parsed.error.issues.map((issue) => issue.path.join('.')).sort() },
    message: 'Invalid Keycloak admin configuration',
  })
}
