---
'@adatechnology/notification-ui': minor
---

Composed screens: `NotificationsWorkspace` and `NotificationSettingsWorkspace`

The package exported only pieces, so the first consumer reassembled the grid by hand: 56 lines for
the inbox page and **221 for the settings page, plus 207 of hook logic**. Compare with the same
product's Documents page — 35 lines — which consumes a workspace. That gap is the whole argument, and
it is what `pluggable-module.md` §4 rejects: every product rebuilding the layout is how these screens
diverged before.

Modelled on `ConversationsWorkspace`, with the same four customization channels and nothing else:

- **vocabulary** → `labels`
- **product UI** → render slots (`renderHeaderActions`, `renderAboveList`, `renderChannelFields`)
- **business rules** → callbacks
- **optional capability by absence** — no `settingsHref`, no settings link. Never a `hasX` flag,
  because a flag is a second way to say what the prop already says, and two ways diverge: someone
  passes `hasSettings` without the href and the screen renders a link to nowhere.

`channels` and `categories` are **required**, deliberately. The package dispatches on five channels
and has no opinion on which ones a product offers — a default would make a bank's settings screen
show "WhatsApp" for a channel it will never send through. The per-channel `hint` ("needs an approved
template", "needs a registered device") is the product's knowledge about its own operation.

`useTemplateEditor` moves into `/headless` with the four subtle decisions the next product would have
had to rediscover: only the highest active version is listed, selection is by id (not object, or
saving leaves the editor on a version that is no longer active), an empty field means absence (not
`''`), and the preview renders through the contracts' `renderTemplate` — the same code the sender
uses, so it cannot drift.

`workspaceContract.test.ts` locks the shape: both screens exported, pieces still exported (a product
with a radically different layout composes them, which beats forking), no `hasX`, no hardcoded text.
Verified by mutation — and the mutation found a hole in my own regex, which required the text to be
glued to the tags while Prettier puts it on its own line.
