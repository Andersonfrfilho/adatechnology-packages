---
'@adatechnology/keycloak-jwt': patch
---

Add an explicit, throttled JWKS readiness probe that validates a resolvable public key without requiring a JWT.
