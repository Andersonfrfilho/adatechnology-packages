import { createPublicKey, createVerify } from 'node:crypto'
import type { KeycloakConfig, KeycloakUser, TokenValidationResult } from './types'

interface JwkKey {
  kty: string
  kid: string
  alg?: string
  n?: string
  e?: string
  x?: string
  y?: string
  crv?: string
}

interface JwksCache {
  keys: JwkKey[]
  fetchedAt: number
}

const JWKS_CACHE_TTL = 300_000
const jwksCache = new Map<string, JwksCache>()

async function fetchJwks(authServerUrl: string, realm: string): Promise<JwkKey[]> {
  const url = `${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`
  const cacheKey = url
  const cached = jwksCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL) {
    return cached.keys
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch JWKS: HTTP ${res.status}`)
  const data = (await res.json()) as { keys: JwkKey[] }
  jwksCache.set(cacheKey, { keys: data.keys, fetchedAt: Date.now() })
  return data.keys
}

function parseJwt(token: string): {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
} {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  return {
    header: JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()),
    signature: parts[2]!,
  }
}

function jwkToPem(jwk: JwkKey): string {
  if (jwk.kty === 'RSA') {
    const key = createPublicKey({
      key: { kty: 'RSA', n: jwk.n!, e: jwk.e! },
      format: 'jwk',
    })
    return key.export({ type: 'spki', format: 'pem' }) as string
  }
  if (jwk.kty === 'EC') {
    const key = createPublicKey({
      key: { kty: 'EC', crv: jwk.crv!, x: jwk.x!, y: jwk.y! },
      format: 'jwk',
    })
    return key.export({ type: 'spki', format: 'pem' }) as string
  }
  throw new Error(`Unsupported JWK key type: ${jwk.kty}`)
}

function extractUser(payload: Record<string, unknown>): KeycloakUser {
  const realmAccess = (payload['realm_access'] as { roles?: string[] }) || {}
  const resourceAccess = (payload['resource_access'] as Record<string, { roles?: string[] }>) || {}
  const clientRoles: Record<string, string[]> = {}
  for (const [client, access] of Object.entries(resourceAccess)) {
    if (access?.roles) clientRoles[client] = access.roles
  }
  return {
    sub: String(payload['sub'] ?? ''),
    email: payload['email'] ? String(payload['email']) : undefined,
    username: payload['preferred_username'] ? String(payload['preferred_username']) : undefined,
    name: payload['name'] ? String(payload['name']) : undefined,
    realmRoles: realmAccess.roles ?? [],
    clientRoles,
  }
}

export async function verifyToken(token: string, config: KeycloakConfig): Promise<TokenValidationResult> {
  try {
    const { header, payload } = parseJwt(token)

    const now = Math.floor(Date.now() / 1000)
    if (payload['exp'] && Number(payload['exp']) < now) return { valid: false, error: 'Token expired' }
    if (payload['nbf'] && Number(payload['nbf']) > now) return { valid: false, error: 'Token not yet valid' }

    const expectedIss = `${config.authServerUrl}/realms/${config.realm}`
    if (payload['iss'] && payload['iss'] !== expectedIss)
      return { valid: false, error: `Invalid issuer: ${payload['iss']}` }

    const kid = header['kid'] as string | undefined

    const jwks = await fetchJwks(config.authServerUrl, config.realm)
    const jwk = kid ? jwks.find((k) => k.kid === kid) : jwks[0]
    if (!jwk) return { valid: false, error: `JWK not found for kid: ${kid}` }

    const pem = jwkToPem(jwk)
    const alg = jwk.alg ?? (header['alg'] as string) ?? 'RS256'

    const parts = token.split('.')
    const signedData = `${parts[0]}.${parts[1]}`
    const signature = Buffer.from(parts[2]!, 'base64url')

    const algoMap: Record<string, string> = {
      RS256: 'RSA-SHA256',
      RS384: 'RSA-SHA384',
      RS512: 'RSA-SHA512',
      ES256: 'sha256',
      ES384: 'sha384',
      ES512: 'sha512',
    }
    const verifyAlg = algoMap[alg] ?? 'RSA-SHA256'

    const verifier = createVerify(verifyAlg)
    verifier.update(signedData)
    if (!verifier.verify(pem, signature)) {
      return { valid: false, error: 'Signature verification failed' }
    }

    return { valid: true, user: extractUser(payload) }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Token validation failed' }
  }
}
