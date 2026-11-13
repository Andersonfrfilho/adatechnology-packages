# @adatechnology/keycloak-jwt

Strict, ESM-only verification of Keycloak access tokens for Bun applications.
It verifies the JWT signature with a remote JWKS and requires issuer, audience,
expiration, subject, an allowed algorithm, and a `kid`.

## Install in a Bun application

```sh
bun add @adatechnology/keycloak-jwt
```

## Verify an access token

```ts
import { createKeycloakJwtVerifier } from '@adatechnology/keycloak-jwt'

const verifier = createKeycloakJwtVerifier({
  issuer: 'https://identity.example.com/realms/transportada',
  audience: 'transportada-api',
  jwksUri: 'https://identity.example.com/realms/transportada/protocol/openid-connect/certs',
  algorithms: ['RS256'],
  requiredClaims: ['company_id'],
  jwks: {
    timeoutMilliseconds: 5_000,
    cooldownMilliseconds: 30_000,
    cacheMaxAgeMilliseconds: 600_000,
    responseSizeLimitBytes: 1_048_576,
  },
})

const accessToken = await verifier.verify(token)
```

`issuer` and `jwksUri` must come from trusted application configuration, never
from a token or request. HTTP JWKS endpoints are accepted only for loopback
hosts, so local Bun tests can use a local identity provider.

`verify` throws `KeycloakJwtVerificationError` with a stable `code`; callers
should convert it to their application's public authentication response without
logging the token or its claims.

Invalid trusted configuration throws `KeycloakJwtConfigurationError` and must
fail application startup rather than become an authentication response.

## JWKS readiness

Creating the verifier is synchronous and does not contact the identity
provider. Call `probeJwks()` explicitly from the application's readiness
check:

```ts
const probe = await verifier.probeJwks()
if (!probe.ready) {
  // Keep this instance out of service.
}

const status = verifier.getJwksStatus()
const ready = status.hasUsableCachedKey && status.fresh
```

The probe returns only a frozen `{ ready: boolean }` result. It reloads the
remote JWKS without requiring a JWT and reports ready only after resolving a
public key with a non-empty `kid` under one of the configured algorithms. It
never returns the JWKS URL, key material, or remote error details.

Concurrent probes share the same request. A fresh usable cache returns ready
without another request, while failed probes are throttled by
`cooldownMilliseconds` before recovery is attempted.

`getJwksStatus()` returns only four booleans and never exposes the JWKS URL or
key material. The status also reports `reloading` and `coolingDown`. Cooldown
cannot be disabled and `cacheMaxAgeMilliseconds` must be greater than or equal
to it, so configuration cannot turn unknown-key traffic into a fetch storm.

## Runtime contract

The package publishes only ESM JavaScript and TypeScript declarations under the
root export. It has no NestJS runtime or peer dependency and requires Bun 1.3+
at runtime.
