# @adatechnology/login-lockout

Progressive login lockout for any app that checks a credential: guest login by phone, staff login by
e-mail, a PIN, an OTP. Not tied to `user-module` (which uses it), so apps with their own login reuse it.

- **Progressive**: 5 failures lock for 15 min, the next lock lasts 30, then 60 ... up to a cap (24 h).
  `multiplier: 1` keeps a fixed duration.
- **Forgiveness**: a quiet period (default 24 h) wipes the counter and the escalation level.
- **Unknown identifiers are locked too**: a guess at an account that does not exist is counted exactly
  like one at a real account, so the response never tells them apart. Only an HMAC of the identifier is
  stored, never the phone or e-mail.
- **Atomic**: parallel failures all count and exactly one crosses the limit (`SELECT ... FOR UPDATE`).
- **Pre-check** before the credential check, keyed by whatever you choose (`[ip, identifier]`).
- A failure never extends a lock that is still running.

## Use

```ts
import { createLoginLockout, LoginLockedError } from '@adatechnology/login-lockout'
import { createDrizzleLockoutStore, loginLockouts } from '@adatechnology/login-lockout/drizzle'

const lockout = createLoginLockout({
  store: createDrizzleLockoutStore({ database, table: loginLockouts }),
  secret: env.LOCKOUT_SECRET, // >= 16 chars; rotating it forgets every current lock
  policy: { maxFailedAttempts: 5, baseLockMinutes: 15, multiplier: 2, maxLockMinutes: 1440, forgiveAfterMinutes: 1440 },
})

const subject = { partition: tenantId, scope: 'guest', identifier: [clientIp, phone] }

await lockout.assertNotLocked(subject) // throws LoginLockedError (generic message, .retryAfterSeconds)
if (!(await verifyCredential())) {
  const outcome = await lockout.registerFailure(subject) // { failures, lockLevel, lockedUntil, hasJustLocked }
  if (outcome.hasJustLocked) audit('locked', outcome.lockLevel) // log the level and the IP, never the identifier
  throw new InvalidCredentialsError() // same error whether the account exists or not
}
await lockout.clear(subject)
```

`check(subject)` returns `{ isLocked, lockedUntil?, retryAfterSeconds? }` without throwing. An array
`identifier` keys the lock by the combination; parts are trimmed and lower-cased before hashing.
Map `LoginLockedError` to HTTP 429 with `Retry-After: error.retryAfterSeconds`.

## Policy (`LockoutPolicy`, all optional)

| Field | Default |
|---|---|
| `maxFailedAttempts` | 5 |
| `baseLockMinutes` | 15 |
| `multiplier` | 2 |
| `maxLockMinutes` | 1440 |
| `forgiveAfterMinutes` | 1440 |

Invalid values throw `LockoutPolicyError` at `createLoginLockout`.

## Table (Postgres)

`loginLockouts` (`@adatechnology/login-lockout/drizzle`) is the table; `loginLockoutColumns()` and
`loginLockoutIndexes` build it inside any `pgSchema`. Columns: `partition`, `scope`, `identifier_hash`,
`failures`, `lock_level`, `locked_until`, `last_failure_at`; unique on `(partition, scope, identifier_hash)`.
Add it to your migrations (`user-module` ships it as `user.login_lockouts`). `createInMemoryLockoutStore()`
is for tests only.

## Tests

`bun test`. Set `LOGIN_LOCKOUT_TEST_DATABASE_URL` to also run the concurrency test against a real Postgres.
