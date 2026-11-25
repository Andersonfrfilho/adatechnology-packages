# @adatechnology/user-module

Stateful user/authentication module: schema, migrations, repositories, use cases and HTTP routes
behind pluggable auth providers. Types and zod schemas live in `@adatechnology/user-contracts`.

```ts
import { createUserModule, createUserRoutes } from '@adatechnology/user-module'

const userModule = await createUserModule({
  db,
  config: {
    tenancy: { mode: 'single', defaultCompanyId: 'main' },
    accessToken: { secret: process.env.ACCESS_TOKEN_SECRET! },
  },
  hooks: { onLoginFailed, onUserLocked, onRefreshReuseDetected, onUserUpdated },
})
const routes = createUserRoutes({ module: userModule })
```

Migrations ship in `dist/migrations` (classic `meta/_journal.json` format, journal table
`user_migrations`). Run them with `runUserMigrations({ db, migrate })`, passing the host's
`drizzle-orm` migrator.

Every option below is **optional**. Without it the module behaves as it always did.

## Login lockout

```ts
config.lockout = { maxFailedAttempts: 5, lockMinutes: 15 }
```

- Off unless `lockout` is set. `maxFailedAttempts` and `lockMinutes` must be integers >= 1, or the
  module throws `ConfigMissingError` at boot.
- The counter and the lock are written by one `UPDATE ... RETURNING` (no read-modify-write), so
  concurrent attempts all count and exactly one crosses the limit. A successful login resets the
  counter with a guarded `UPDATE` that refuses a locked account, closing the race with the lock.
- While locked, even the right password fails; a failure while locked does not extend the lock. After
  `lockMinutes` the counter restarts at 1.
- The response is always the same `InvalidCredentialsError`. Unknown, passwordless and locked
  accounts spend one password-hash verification, like a wrong password (no timing oracle).
- Completing a password reset or an admin reactivation/unlock clears the lock.
- Hooks: `onLoginFailed` on every failure (`reason`: `user_not_found`, `invalid_password`,
  `user_inactive`, `user_locked`; `userId` when the account exists) and `onUserLocked` once, on the
  attempt that locks (`userId`, `email`, `failedAttempts`, `lockedUntil`).
- `UserProfile.lockedUntil` is present only while the account is locked.

## Admin update

`PATCH /admin/users/:id` (scope `user:admin`), body `{ role?, isActive?, unlock? }` with at least one
field. Use case: `userModule.useCases.updateUser.execute({ id, role, isActive, unlock, companyId })`.

- Never deletes: deactivate with `isActive: false`.
- Changing the role or deactivating revokes the user's refresh tokens. Access tokens stay valid until
  they expire (`accessToken.expiresInSeconds`, 15 min by default), so keep that short.
- Reactivating or `unlock: true` clears a lockout. Asking for what is already true writes nothing and
  emits nothing.
- `onUserUpdated` carries `changes` (`role`, `isActive`, `unlocked`, `sessionsRevoked`) for auditing.
- `role` is a single free-form string per user (the host owns the vocabulary).

## Admin sets another user's password

`PUT /admin/users/:id/password` (scope `user:admin`), body `{ password }` (same rules as sign-up),
answers `204`. Use case: `userModule.useCases.setUserPassword.execute({ id, password, companyId, actorUserId })`.

- Revokes every refresh token of that user and clears a pending lockout.
- Only local accounts: a user from an external provider (Keycloak) gets `409 USER_PASSWORD_NOT_LOCAL`.
- `onPasswordChanged` fires with `changedByUserId` (the admin) for the audit trail. Self-service
  reset keeps firing it without that field.

## Refresh cookie name and path

```ts
config.refreshToken = { cookieName: 'staff_refresh', cookiePath: '/staff', sameSite: 'lax' }
```

`sameSite` accepts `lax` (default), `none` (screen on another site; HTTPS) and `strict` (same site, and
the cookie is not sent on navigation coming from another site, so the first open through an external
link arrives without a session). The cookie is always `Secure; HttpOnly`.

Defaults: `user_refresh_token` and `/`. The name accepts `A-Z a-z 0-9 _ -`; the path must start with
`/` and contain no `;`, spaces or commas. Invalid values fail at boot. Login, refresh and logout all
use the resolved policy (`userModule.refreshCookie`), and the logout cookie repeats the issued
attributes. Two instances on one origin need different names.

## Remember me (opt-in)

`POST /auth/login` accepts an optional `rememberMe` boolean.

| `rememberMe` | Cookie | Server-side refresh lifetime |
|---|---|---|
| absent | persistent, exactly as before | `refreshToken.expiresInSeconds` (30 days) |
| `true` | persistent (`Max-Age`) | `refreshToken.rememberExpiresInSeconds` (default = `expiresInSeconds`) |
| `false` | session cookie (no `Max-Age`; gone when the browser closes) | `refreshToken.sessionExpiresInSeconds` (default 24 h) |

The choice rides in the cookie value (`m~<token>` / `s~<token>`), so refresh rotation repeats the same
lifetime and no column or store change is needed; cookies without a prefix keep the old behaviour.
The access token stays short-lived in every case. Apps that never send the field behave as before.

## Refresh rotation and reuse detection

- Rotation is one `UPDATE refresh_tokens SET revoked_at = now WHERE token_hash = $1 AND revoked_at IS
  NULL AND expires_at > now RETURNING user_id`: of two concurrent rotations exactly one wins.
- The rotated row stays as a marker. Presenting it again outside `refreshToken.reuseGraceSeconds`
  (default 10) revokes **every** refresh token of that user and fires `onRefreshReuseDetected`.
  Inside the grace window it is treated as two tabs racing: plain 401, nothing revoked. `0` is strict.
- Logout deletes the row, so replaying a logged-out cookie is a plain 401, not a reuse.
- `RefreshTokenStorePort.rotate` may now return `{ reusedForUserId }`; custom stores that never
  return it keep working. `RefreshTokenRepository.deleteExpired({ now })` is available for a cleanup job.

## Self sign-up

```ts
config.signUp = { role: 'member' } // multi-tenant: { role: 'member', companyId: 'acme' }
```

Off by default: without `signUp` the route is not published. `POST /auth/signup` is public, takes
`{ email, name, password }`, creates the user with the configured role (the body cannot choose it),
opens a session like login (201 + refresh cookie). A taken e-mail answers 409, so this route does
reveal which e-mails exist; rate-limit it at the host.

## Audiences

```ts
config.audience = 'customers' // default: 'default'
```

One module instance per audience over the same database. `users.audience` is part of every unique
index, every read and every write, so the same e-mail can exist in two audiences and a refresh token
from one never opens a session in the other. A non-default audience also becomes the JWT `aud`
(unless `accessToken.audience` is set), so an access token from one instance fails verification in the
other even with a shared secret. Pair it with distinct `refreshToken.cookieName`s.

Migration `0002` adds `audience varchar(64) NOT NULL DEFAULT 'default'`, so existing rows stay valid
and in `default`, plus `failed_login_attempts`, `locked_until` and `refresh_tokens.revoked_at`; it
rebuilds the four unique indexes with `audience`. It is additive for data; the old indexes are
dropped and recreated inside the same migration.

## Tests

`bun test` runs the unit suite. `src/integration.test.ts` proves the atomic statements and the
migration against a real Postgres and is skipped unless `USER_MODULE_TEST_DATABASE_URL` is set:

```bash
docker run -d --rm -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
USER_MODULE_TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres bun test src/integration.test.ts
```
