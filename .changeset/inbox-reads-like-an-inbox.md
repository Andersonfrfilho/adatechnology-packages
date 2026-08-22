---
'@adatechnology/notification-ui': minor
---

The inbox reads like an inbox: one heading per page, a time on every row

Four defects, all visible in the first product to mount the workspaces, none of them in the CSS:

**Three identical headings on one screen.** The page wrote its own `<h1>` "Notificações", the
workspace drew a second `<h1>` "Notificações", and the list titled itself `<h2>` "Notificações". Two
of the three were ours. The list is not the screen — it is the inbox inside it — so `list.title`
becomes **"Caixa de entrada" / "Inbox"**, which also fixes the region's accessible name: two
landmarks called the same thing are two landmarks a screen reader cannot tell apart.

**Two `<h1>` per page.** A host that already owns the page heading had no way to say so, so both
workspaces gained `renderHeader`. It is substitution, not a switch: absent, the default header still
draws. Same shape as the slots already there — a `hasHeader` flag would be a second way to say what
the prop says, and two ways diverge.

**"Nothing here yet" printed next to a full list.** `renderEmpty` was rendered unconditionally, beside
a list that already had its own empty state. The workspace does not know whether the list is empty —
the list does. The slot now travels down and replaces the list's default, and only when
`notifications.length === 0` with the query settled.

**A row that never said when.** The one thing an inbox exists to answer. Each row now carries a
`<time dateTime={createdAt}>` with relative text ("agora", "5 min atrás", "ontem"), the full
timestamp in `title`, and an absolute date past a week. Formatting is `Intl.RelativeTimeFormat` +
`Intl.DateTimeFormat`, so no date vocabulary enters the locale files and every language the host
declares works for free — which is why the provider's context now carries the resolved `locale` and
not only its messages: without the tag, a screen in Portuguese would read "5 minutes ago".
`formatNotificationTime` is exported from `/headless`, since a product that builds its own list needs
it just the same. `now` is a parameter, not `Date.now()` — a test that depends on the clock is a test
that fails at midnight. A timestamp in the future (clock skew between server and browser) renders as
"now": the inbox never announces something that has not arrived.

Around that: the unread count now appears on the list itself and not only on the bell, loading is a
skeleton with the shape of the rows instead of the word "Carregando…" (and holds still under
`prefers-reduced-motion`), the list is a bordered card whose rows respond to hover, the unread dot
moved out of the absolutely-positioned corner into the heading line where it reads as part of the
title, and the body clamps at two lines so rows keep a rhythm. Every value still comes from
`--adn-*` with a neutral fallback — the package acquired no colour of its own.

`inboxDesign.test.ts` locks each of the four: the two titles differ in both locales, both workspaces
accept `renderHeader`, the workspace no longer draws the empty state and the list does, and the row
carries a machine-readable `<time>`. The locale files are checked for key parity, because a key added
to one language and forgotten in the other is how a screen ends up showing its own translation key.
