import { describe, it, expect } from 'bun:test'
import { verifyToken, createKeycloakMiddleware } from '../src/index.js'

const config = {
  realm: 'test',
  authServerUrl: 'http://localhost:8080/auth',
  clientId: 'test-app',
}

describe('verifyToken', () => {
  it('rejects invalid JWT format', async () => {
    const result = await verifyToken('not-a-token', config)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects expired token', async () => {
    const expiredPayload = {
      sub: 'user-1',
      email: 'a@b.com',
      exp: Math.floor(Date.now() / 1000) - 3600,
      iss: `${config.authServerUrl}/realms/${config.realm}`,
    }
    const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')}.sig`
    const result = await verifyToken(token, config)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('rejects token from future (nbf)', async () => {
    const futurePayload = {
      sub: 'user-1',
      nbf: Math.floor(Date.now() / 1000) + 3600,
      iss: `${config.authServerUrl}/realms/${config.realm}`,
    }
    const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(futurePayload)).toString('base64url')}.sig`
    const result = await verifyToken(token, config)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not yet valid')
  })

  it('rejects invalid issuer', async () => {
    const payload = {
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'http://wrong-issuer/realms/other',
    }
    const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`
    const result = await verifyToken(token, config)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('issuer')
  })
})

describe('createKeycloakMiddleware', () => {
  const middleware = createKeycloakMiddleware(config)

  it('blocks requests without Authorization header', async () => {
    const req = new Request('http://localhost/api/test')
    const result = await middleware.handler(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('blocks requests with invalid Bearer token', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer bad-token' },
    })
    const result = await middleware.handler(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})
