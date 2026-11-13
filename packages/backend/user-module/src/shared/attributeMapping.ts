/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  ProviderMisconfiguredError,
  type AttributeMapping,
  type AttributeMappingRule,
} from '@adatechnology/user-contracts'

/**
 * Sem `role`: papel é vocabulário do produto, não do módulo. Um default `'user'` produziria usuários
 * com um papel que o host não reconhece — e que, portanto, nunca conseguiriam entrar. O host declara
 * o seu (`{ value: AGENT_ROLE.AGENT }` ou `{ from: 'realm_role' }`), e a ausência falha no boot.
 */
export const DEFAULT_KEYCLOAK_ATTRIBUTE_MAPPING: Omit<AttributeMapping<Record<string, unknown>>, 'role'> = {
  email: { from: 'email' },
  name: { from: 'name' },
}

function resolveRule(
  claims: Record<string, unknown>,
  rule: AttributeMappingRule<Record<string, unknown>>,
): string | undefined {
  if ('value' in rule) return rule.value
  const claimValue = claims[rule.from as string]
  return typeof claimValue === 'string' ? claimValue : undefined
}

/**
 * Claims de um provedor OIDC/OAuth2 nunca são confiáveis por forma — o mapeamento declara
 * explicitamente de onde vem cada campo, e a ausência do obrigatório (`email`) é erro de
 * configuração do host, não do usuário.
 */
export function applyAttributeMapping(params: {
  readonly claims: Record<string, unknown>
  readonly mapping: AttributeMapping<Record<string, unknown>>
}): { readonly email: string; readonly name: string; readonly role: string } {
  const email = resolveRule(params.claims, params.mapping.email)
  if (!email) throw new ProviderMisconfiguredError({ reason: 'attributeMapping.email não resolveu nenhum claim' })

  const name = (params.mapping.name ? resolveRule(params.claims, params.mapping.name) : undefined) ?? email

  const role = params.mapping.role ? resolveRule(params.claims, params.mapping.role) : undefined
  if (!role) throw new ProviderMisconfiguredError({ reason: 'attributeMapping.role não resolveu nenhum claim' })

  return { email, name, role }
}
