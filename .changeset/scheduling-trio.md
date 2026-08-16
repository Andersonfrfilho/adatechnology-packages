---
'@adatechnology/module-http': patch
'@adatechnology/scheduling-contracts': patch
'@adatechnology/scheduling-module': patch
'@adatechnology/scheduling-ui': patch
'@adatechnology/web-booking-widget': patch
---

Service and resource scheduling as a pluggable trio, plus an embeddable public booking widget

**`scheduling-contracts`** — types, Zod schemas, ports and the twelve domain errors, kept free of
runtime dependencies so both the module and any host can type against them without pulling in
Drizzle. Capability is by absence: no `VideoMeetingPort` means no meeting link, no `CalendarSyncPort`
means no external mirror — never a boolean flag the host has to remember to check.

**`scheduling-module`** owns the decisions a scheduling backend keeps re-deriving:

- **Overlap is a database constraint, not an application check.** `EXCLUDE USING gist` on the
  booking range makes two confirmed bookings for the same resource physically impossible to
  insert, race conditions included — no advisory lock, no read-then-write window. This requires
  the `btree_gist` extension, which the module's first migration attempts to install
  (`CREATE EXTENSION IF NOT EXISTS btree_gist`). On managed Postgres with an extension allowlist
  this can fail silently by policy; **the host must confirm `btree_gist` is permitted before
  running migrations**, or bookings will fail at the constraint rather than at setup.
- **Config is validated at boot, not at first use.** A missing `maxLookaheadDays` or a
  `calendarSync.enabled: true` without a `CalendarSyncPort` throws immediately from
  `createSchedulingModule` (`ConfigMissingError`, `CalendarSyncDisabledError`). Finding this out
  from a 500 in production, on the first booking someone tries to sync, would be worse.
- **Reminders are a cron sweep, not a queue.** `SweepDueReminders` reads reservations due for a
  reminder fresh on every tick and claims them with `FOR UPDATE SKIP LOCKED`, so two overlapping
  cron runs never double-send. A queue would solve a problem this capability doesn't have — the
  cost is a host that already has a scheduler wiring in one more cron descriptor.
- **Video and calendar sync are ports, not built-in vendor clients.** Zoom, Meet, Google Calendar
  and Outlook stay out of the dependency tree entirely; a host without either capability pulls in
  nothing beyond the port's TypeScript signature. Failure in either one is logged and does not
  block booking confirmation — they are additive affordances, not requirements.
- **HTTP ships for both `Bun.serve` and uWebSockets.js**, dispatched through the same route table,
  with a parity test asserting identical responses from both adapters. Migrations, journal and
  tables live under `pgSchema('scheduling')` and never touch the host's `public` schema.

**`scheduling-ui`** mirrors every `scheduling-module` use case through `SchedulingApi`, stripped of
`companyId` on every method — the host resolves tenant from its own authenticated context before
calling in, so the contract makes the BOLA-unsafe shape (a client-suppliable tenant id) impossible
to express. `SchedulingWorkspace`'s open area is controlled or uncontrolled by whether the host
passes `area`/`onAreaChange`, so URL-synced navigation is opt-in rather than assumed.

**`web-booking-widget`** is a public-facing Web Component, deliberately outside the React tree the
other three packages assume: a booking page embedded on a marketing site cannot require the
visitor to load React. It reads the visitor's own timezone for slot display and takes theme purely
through CSS custom properties on the host element — no built-in palette to override.
