---
'@adatechnology/meta-whatsapp-module': minor
---

Stop forcing consumers onto a specific drizzle instance and major

Three coupling problems made the module unusable by its first real consumer:

- `drizzle-orm` was a regular dependency, so package managers installed a second
  copy nested under the module. Two drizzle instances are incompatible in types
  *and* at runtime (separate symbol registries), so a host could never hand over
  its own `db`. It is now a peer dependency.
- The `db` parameter was typed `BunSQLDatabase`, excluding every host not on Bun's
  SQL driver. The module only uses the generic query builder, so it now accepts
  `PgDatabase` and works on node-postgres, postgres.js or bun-sql alike.
- The pin was `1.0.0-rc.4` — a release candidate. drizzle's stable line is 0.45.x,
  and a reusable module has no business dragging every consumer onto an RC. The
  peer range is now `>=0.36.0 <1`, and relations-v2 generics (1.0-only) are gone.

`runMetaWhatsAppMigrations` now takes `{ db, migrate }`: the migrator is
driver-specific, so the host supplies its own. `metaWhatsAppMigrationsFolder()`
and `META_WHATSAPP_MIGRATIONS_TABLE` are exported for hosts that call their
migrator directly. Migrations were regenerated in the stable journal layout —
same SQL, no schema change.

BREAKING for anyone already calling `runMetaWhatsAppMigrations(db)`; nothing is
published on a stable tag yet, so no released consumer is affected.
