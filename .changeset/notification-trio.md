---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-module': minor
'@adatechnology/notification-client': minor
'@adatechnology/notification-ui': minor
'@adatechnology/push-provider': minor
'@adatechnology/email-provider': minor
---

Multi-channel notification as a pluggable trio: inbox, push, email and WhatsApp from one call

The capability had been written five times across products before this. Not variations on a
theme — the same fan-out, the same retry, the same preference lookup, diverging slightly each
time. That is what the second-use rule exists to stop, and it was well past the second use.

**`notification-module`** owns the decisions a host should not have to make again:

- **Fan-out is one call.** `sendNotification` reads the recipient's preferences, respects quiet
  hours, checks suppression, and creates one delivery per channel. The caller says *what*
  happened, not *where* to send it.
- **`dedupeKey` is not a nicety.** `order:1042:ready` means the customer gets one message even if
  the job runs twice, the webhook arrives duplicated, or two pods pick up the same event. Without
  it, retry becomes spam — and spam in push means uninstalls.
- **Retry follows the driver's classification, not a guess.** `retriable` re-queues with backoff,
  `permanent` stops, and `invalid-target` deactivates the device or suppresses the address. Push
  tokens die constantly — reinstalls, cleared caches, new phones. Folding that into `permanent`
  would leave every replaced phone behind a token the queue retries forever.
- **The webhook route does not exist without a secret.** Mounting it to accept unsigned payloads
  would be the opposite of fail-closed. Signature is verified over the raw bytes, with a timestamp
  window and a nonce against replay.

**`push-provider`** (Expo, FCM) and **`email-provider`** (SMTP, Resend, SES) are stateless drivers
behind one port each. Translating each vendor's error vocabulary belongs there and nowhere else:
only that layer knows Expo's `DeviceNotRegistered` and FCM's `UNREGISTERED` are the same event.
`firebase-admin` loads through a dynamic import, so an Expo-only host never pulls in the Firebase
SDK. The email package also parses bounce and complaint receipts — the half of email that decides
whether the domain still delivers a year from now.

**`notification-client`** is isomorphic and deliberately does not use `EventSource`. That API
takes no headers, so the token would have to travel in the query string, where it leaks into
server logs, history and referrers — and React Native does not ship it at all. `fetch` plus
`ReadableStream` solves both and behaves identically in RN, web, Node and Bun.

**`notification-ui`** ships in two layers. The headless hooks exist because a ready-made component
rarely survives contact with a product's design system, and the usual escape hatch — twenty
styling props — is a theming system through the back door that serves nobody well.

Suppression keys are HMAC hashes, never plaintext addresses: the list exists to stop sending, not
to become a contact database.
