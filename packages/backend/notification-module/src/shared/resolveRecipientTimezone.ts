/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Decisão Q4 da spec: `preferences.timezone` (escolha explícita do usuário) > resolver de
 * destinatário > device mais recente > default do config. O device é só fallback — um usuário
 * viajando divergiria da preferência real, e a preferência é o único sinal que o próprio usuário
 * controla diretamente.
 */

export function resolveRecipientTimezone(params: {
  readonly preferenceTimezone?: string | null
  readonly recipientTimezone?: string
  readonly mostRecentDeviceTimezone?: string | null
  readonly defaultTimezone: string
}): string {
  return (
    params.preferenceTimezone ?? params.recipientTimezone ?? params.mostRecentDeviceTimezone ?? params.defaultTimezone
  )
}
