---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

meta-whatsapp: migrations for drizzle-orm 0.x, interactive messages and mode change hook

- **module**: migrations also ship in the classic journal layout (`dist/migrations-journal/`) for
  drizzle-orm 0.36–0.45 migrators. `runMetaWhatsAppMigrations({ db, migrate, layout })` accepts
  `'v1' | 'journal'`; without `layout` it keeps using the 1.x folder and falls back to the journal
  when a 0.x migrator refuses it. No change for current 1.x hosts.
- **module**: `conversations.send.sendInteractive` sends buttons or lists (multiple sections, row
  descriptions) through the window check and transcript logging, validating the Meta limits first.
- **module**: `conversations.requestHuman`, `actorId` on takeover/release, and
  `hooks.onConversationModeChanged` for audit trails.
- **module**: `providers.inboundQueue` and `webhook.processInboundDispatch` wire the durable inbound
  queue through the factory; `docs/postgres-only.md` shows nonce store and queue on Postgres only.
- **contracts**: `ChannelAdapterInterface.sendInteractiveList` accepts `sections` (rows with optional
  `description`); new `WHATSAPP_CHOICE_LIMIT` entries, `listInteractiveLimitViolations`,
  `assertInteractiveWithinLimits`, `InteractiveLimitExceededError`, `ConversationModeChange`.
