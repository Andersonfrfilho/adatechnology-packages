---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
'@adatechnology/user-ui': minor
---

user-module: configurable login lockout (atomic, constant-time, with `onUserLocked`), admin
`PATCH /admin/users/:id` (role / activate / unlock, revokes sessions), configurable refresh cookie
name and path, atomic refresh rotation with reuse detection, opt-in self sign-up, and per-audience
instances (migration `0002`: `users.audience`, `failed_login_attempts`, `locked_until`,
`refresh_tokens.revoked_at`). user-contracts: matching config, events and schemas. user-ui:
`SignUpScreen`/`SignUpForm`/`useSignUp` and the locked badge plus unlock action in `TeamWorkspace`.
All additions are optional; defaults keep current behaviour.
