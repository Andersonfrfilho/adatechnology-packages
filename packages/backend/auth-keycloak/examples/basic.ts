import { verifyToken, createKeycloakMiddleware } from '../src/index.js'
import type { KeycloakConfig } from '../src/index.js'

const config: KeycloakConfig = {
  realm: 'demo',
  authServerUrl: 'http://localhost:8080/auth',
  clientId: 'demo-app',
}

async function main() {
  console.log('Test 1: Invalid token')
  const r1 = await verifyToken('invalid.token.here', config)
  console.log('  Valid:', r1.valid, 'Error:', r1.error)

  console.log('\nTest 2: Expired token (valid format, expired)')
  const expiredPayload = {
    sub: 'user-1',
    email: 'a@b.com',
    exp: Math.floor(Date.now() / 1000) - 3600,
    iss: `${config.authServerUrl}/realms/${config.realm}`,
  }
  const expiredToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')}.sig`
  const r2 = await verifyToken(expiredToken, config)
  console.log('  Valid:', r2.valid, 'Error:', r2.error)

  console.log('\nTest 3: Middleware without Authorization header')
  const middleware = createKeycloakMiddleware(config)
  const req = new Request('http://localhost/api/test')
  const res = await middleware.handler(req)
  if (res) {
    console.log('  Status:', res.status, 'Blocked:', res.status === 401)
  }

  console.log('\nTest 4: Middleware with invalid Bearer token')
  const req2 = new Request('http://localhost/api/test', { headers: { authorization: 'Bearer bad.token.here' } })
  const res2 = await middleware.handler(req2)
  if (res2) console.log('  Status:', res2.status)
  else console.log('  Token accepted (unexpected)')

  console.log('\nAuth-Keycloak demo complete')
}

main().catch(console.error)
