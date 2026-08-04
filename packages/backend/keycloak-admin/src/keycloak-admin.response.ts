const MAX_DETAIL_LENGTH = 200

/**
 * Extrai o motivo que o Keycloak devolve, sempre como texto curto e sempre por allowlist de campo.
 */
export async function readKeycloakDetail(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  if (text === '') return undefined

  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object') return text.slice(0, MAX_DETAIL_LENGTH)

    const payload = parsed as Record<string, unknown>
    const detail = payload.errorMessage ?? payload.error_description ?? payload.error
    return typeof detail === 'string' ? detail.slice(0, MAX_DETAIL_LENGTH) : undefined
  } catch {
    return text.slice(0, MAX_DETAIL_LENGTH)
  }
}
