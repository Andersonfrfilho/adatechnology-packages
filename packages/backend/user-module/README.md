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
// progressive + unknown e-mails:
config.lockout = { maxFailedAttempts: 5, lockMinutes: 15, lockMultiplier: 2, identifierSecret: env.LOCKOUT_SECRET }
```

- Progressive (opt-in): `lockMultiplier: 2` makes each new lock last twice the previous one
  (`lockMinutes`, 2x, 4x ...) up to `maxLockMinutes` (default 1440). Without it the duration stays fixed.
  `forgiveAfterMinutes` (default 1440) of silence restarts the counter and the level; a successful login,
  a password reset or an admin unlock also reset the level.
- Unknown e-mails: set `identifierSecret` (>= 16 chars) and an e-mail that does not exist is counted and
  locked like a real account (stored only as an HMAC in `user.login_lockouts`), answering the same
  `InvalidCredentialsError`. The `onLoginFailed` reason becomes `user_locked` once it is locked.
  Built on `@adatechnology/login-lockout`, which you can also use directly for other logins (guest, PIN).
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

The choice is stored **on the refresh token row** (`refresh_tokens.remember_me`) and inherited by every
rotation, so it cannot be changed from the client. `UserSession.rememberMe` reports it, and the cookie value
is just the token (the `Max-Age` is what differs). Cookies issued before this change carry a legacy `m~` /
`s~` prefix; it is still read (`parseRefreshCookieValue`, exported) as a one-off hint for the first rotation
of a token that has no stored choice, then recorded. Without a hint or a stored choice the lifetime is the
old default. The access token stays short-lived in every case. Apps that never send the field behave as before.

### Absolute session cap

`refreshToken.absoluteExpiresInSeconds` (absent = no cap) limits the whole rotation chain, counted from the
login (`refresh_tokens.session_started_at`, copied on every rotation). Each new token lives at most the time
left until the cap; past it, `POST /auth/refresh` answers 401 and the person signs in again. A token expired
by the cap is simply refused (no reuse marker), so presenting it again never revokes the person's other
sessions. Custom `refreshTokenStore`s implement the cap through `rotate({ absoluteExpiresInSeconds,
expiresInSecondsByChoice, rememberMeHint })`; a store that ignores those fields keeps the old behaviour.

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

## Account self-service (password, e-mail, phone, assisted recovery)

All opt-in; every sensitive change asks for the **current password** (wrong answers count in the account lockout; a
locked account is refused) and answers `403 USER_CURRENT_PASSWORD_INVALID`.

| Route | What it does |
|---|---|
| `POST /auth/password/change` | Current + new password. Ends every other session; the caller keeps theirs (new refresh cookie). |
| `POST /auth/email/change` | Needs `config.emailChange`. Sends a single-use link (24 h by default) to the **new** address; the account keeps the old e-mail until it is opened. |
| `POST /auth/email/confirm` | Public. Consumes the link, switches the e-mail, marks it verified. Unknown, expired and used links answer the same `400`. |
| `POST /auth/phone/change` | Valid (`config.phone.normalize`) and unique per company/audience (`409 USER_PHONE_ALREADY_EXISTS`, `details.field = phone`). Saved as **not verified**. |
| `POST /auth/phone/verification`, `POST /auth/phone/verify` | Need `config.phoneVerification`. Resend (cooldown) and type-the-code check. |
| `POST /admin/users/:id/recovery` | Needs `config.passwordReset`. Staff, after checking identity off-line: `{ email }` swaps the e-mail, ends sessions and sends the reset link to the new address; `{ unlock: true }` clears the lockout. |

Host notifications are hooks (the module never owns your copy): `onEmailChangeRequested` (new address + link),
`onEmailChanged` (`previousEmail`: tell the old address "your e-mail was changed"), `onPhoneChanged`,
`onPhoneVerified`, `onPasswordChanged`, and `onAccountRecovered` (audit: actor, target, flags — never values).
Logs carry ids and codes, never addresses or numbers.

### Phone verification methods

The method is a **provider chosen by the host's configuration**, not by code. Ids (`PHONE_VERIFICATION_METHOD`):
`whatsapp-inbound` (default, free), `whatsapp-template` and `sms` (outbound, prepared and off until you plug a provider).
`phoneVerification.selectMethod({ companyId })` returns the company's choice; a method that is not configured falls back
to `whatsapp-inbound`. `listPhoneVerificationMethods({ config, senders })` returns each option with `isAvailable` and a
`reason`, for a settings screen to disable what is missing.

- **Inbound (`config.phoneVerification.inbound`)**: the start response carries `inbound: { code, message }`
  (`"Confirmar meu número: 482913"`). The UI opens `https://wa.me/<company number>?text=<message>`. When the person sends it,
  the WhatsApp host calls, before its bot flow:

  ```ts
  const result = await userModule.useCases.matchInboundPhoneVerification.execute({ text, senderPhone, companyId })
  // 'ignored'  -> not a confirmation, run the bot as usual
  // 'verified' -> reply "Pronto, seu número foi confirmado"
  // 'rejected' -> short generic reply (wrong code, expired, used, wrong sender, too many attempts)
  ```

  The account is found **by the sender's number**, so one can only confirm their own number. The code is stored as an
  HMAC, expires (10 min), is single use and limited to `maxAttempts` (5). Spaces, case and accents in the text are tolerated.
- **Outbound, implemented and off until you plug it** (`providers.verificationSenders`; method resolution per company with fallback stays as above):
  - `createWhatsappTemplateVerificationSender({ templateName, languageCode?, send })`: the Meta **authentication template** (body with the code plus the copy-code button, `buildAuthenticationTemplateComponents`). `send` is yours, usually a call to `sendTemplate` of `@adatechnology/meta-whatsapp-module` / `meta-whatsapp-provider` with the `components` it receives; the template must be approved by Meta first.
  - `createSmsVerificationSender({ gateway })` over a small `SmsGatewayPort` (`sendSms({ to, body })` returning a `DeliveryAttemptResult`). One concrete gateway ships: `createTwilioSmsGateway({ accountSid, authToken, from })` (a single HTTP call). Other vendors that fit the same port: Zenvia and Infobip (Brazil-friendly, local sender ids), Vonage. Each is a ~30-line adapter.
  - `channelOrder` sets the fallback chain; `createInMemoryVerificationSender()` is the test provider.

### The bot recognises a pending activation (no code needed)

`createPendingVerificationInterceptor({ useCases, messenger, texts? })` is called by the WhatsApp host **before** its normal flow on every received message:

```ts
const result = await interceptor.handle({ senderPhone, companyId, text, buttonId })
if (result.outcome === 'handled') return        // the bot already answered
if (result.isConfirmed) { /* optional: show the menu now */ }
// 'continue': run the normal flow
```

- A number with a pending phone verification that sends **any text** gets, **once per code**, "Vi que você está ativando sua conta (Maria S., m***@e***.com). Foi você?" with the buttons **Sim, confirmar** / **Não fui eu** (texts are yours, `texts` override the defaults, so they can sit in an editable template). The bot never reveals more than the masked name and e-mail.
- **Sim**: the sender's number is the proof; still single-use, expiring and attempt-limited. Reply "Pronto, seu número foi confirmado ✅".
- **Não fui eu**: the code is cancelled, `onPhoneVerificationDeclined` fires (audit trail / staff notice; no number or e-mail in the event) and, with an e-mail driver, the account owner is told.
- A text carrying the code ("Confirmar meu número: 482913") still works as before. If the question is ignored, the next message follows the normal flow. Use cases behind it: `offerPendingVerification`, `confirmPendingVerification`, `declinePendingVerification` (migration `0006` adds `account_challenges.asked_at`). The interceptor is host-wired on purpose: `meta-whatsapp-module` keeps its hooks generic (`onMessageReceived` returning `handled`/`continue`) and needs no change.

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
