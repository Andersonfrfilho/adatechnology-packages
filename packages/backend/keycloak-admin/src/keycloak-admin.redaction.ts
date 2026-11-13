import { KEYCLOAK_ADMIN_REDACTED } from './keycloak-admin.constant.js'

export type SecretRedactor = {
  text(value: string): string
  value<TValue>(value: TValue): TValue
  with(...secrets: readonly (string | undefined)[]): SecretRedactor
}

function replaceAll({ secrets, text }: { secrets: readonly string[]; text: string }): string {
  return secrets.reduce((current, secret) => current.split(secret).join(KEYCLOAK_ADMIN_REDACTED), text)
}

function redactDeep({ secrets, value }: { secrets: readonly string[]; value: unknown }): unknown {
  if (typeof value === 'string') return replaceAll({ secrets, text: value })
  if (Array.isArray(value)) return value.map((item) => redactDeep({ secrets, value: item }))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep({ secrets, value: item })]))
  }
  return value
}

/**
 * Última barreira antes de um segredo virar mensagem de erro ou log do consumidor.
 * Vale como defesa em profundidade: o contexto do erro já é allowlist, isto cobre o eco do Keycloak.
 */
export function createSecretRedactor(...secrets: readonly (string | undefined)[]): SecretRedactor {
  const known = secrets.filter((secret): secret is string => typeof secret === 'string' && secret !== '')

  return {
    text(value) {
      return replaceAll({ secrets: known, text: value })
    },
    value(value) {
      return redactDeep({ secrets: known, value }) as typeof value
    },
    with(...additional) {
      return createSecretRedactor(...known, ...additional)
    },
  }
}
