/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * De onde vem o Bearer: token fixo, ou um token OAuth 2 (Keycloak e afins) renovado antes de vencer.
 * Grant escolhido pelo que foi configurado: usuário e senha → `password`; refresh token → `refresh_token`;
 * nada disso → `client_credentials`.
 */
import type { ServerEnvironment } from './expense-mcp.constant'

export type TokenProvider = { token(): Promise<string>; invalidate(): void }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const RENEW_BEFORE_SECONDS = 30

export function createTokenProvider(environment: ServerEnvironment, fetchImpl: FetchLike = fetch): TokenProvider {
  const fixed = environment.EXPENSE_API_TOKEN
  if (fixed !== undefined) return { invalidate: () => undefined, token: async () => fixed }

  const tokenUrl = environment.EXPENSE_OAUTH_TOKEN_URL
  const clientId = environment.EXPENSE_OAUTH_CLIENT_ID
  if (tokenUrl === undefined || clientId === undefined) throw new Error('OAuth sem token URL ou client id')

  let cached: { readonly value: string; readonly expiresAt: number } | undefined
  let refreshToken = environment.EXPENSE_OAUTH_REFRESH_TOKEN

  async function request(): Promise<{ value: string; expiresAt: number }> {
    const form = new URLSearchParams({ client_id: clientId as string })
    if (environment.EXPENSE_OAUTH_CLIENT_SECRET !== undefined)
      form.set('client_secret', environment.EXPENSE_OAUTH_CLIENT_SECRET)
    if (environment.EXPENSE_OAUTH_SCOPE !== undefined) form.set('scope', environment.EXPENSE_OAUTH_SCOPE)
    if (environment.EXPENSE_OAUTH_USERNAME !== undefined && environment.EXPENSE_OAUTH_PASSWORD !== undefined) {
      form.set('grant_type', 'password')
      form.set('username', environment.EXPENSE_OAUTH_USERNAME)
      form.set('password', environment.EXPENSE_OAUTH_PASSWORD)
    } else if (refreshToken !== undefined) {
      form.set('grant_type', 'refresh_token')
      form.set('refresh_token', refreshToken)
    } else {
      form.set('grant_type', 'client_credentials')
    }
    const response = await fetchImpl(tokenUrl as string, {
      body: form,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
    if (!response.ok) throw new Error(`o servidor de token respondeu ${response.status}`)
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown; refresh_token?: unknown }
    if (typeof body.access_token !== 'string') throw new Error('o servidor de token não devolveu access_token')
    if (typeof body.refresh_token === 'string' && refreshToken !== undefined) refreshToken = body.refresh_token
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 60
    return { expiresAt: Date.now() + Math.max(expiresIn - RENEW_BEFORE_SECONDS, 5) * 1000, value: body.access_token }
  }

  return {
    invalidate() {
      cached = undefined
    },
    async token() {
      if (cached === undefined || cached.expiresAt <= Date.now()) cached = await request()
      return cached.value
    },
  }
}
