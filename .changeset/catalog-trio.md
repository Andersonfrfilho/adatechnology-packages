---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
'@adatechnology/module-http': minor
---

Catalog management as a pluggable trio, and a shared HTTP layer extracted from it

**`catalog-contracts`** — the types already existed, well designed, inside
`products-ui/src/providers/types.ts`. Stuck in the frontend, the backend could not type against
them. Extracting was what made the trio possible: both ends now break at compile time when the
contract changes, instead of drifting in production.

Deliberately left out: `PriceReference`, `PriceHistoryEntry` and `RelatedProduct`. They come from
invoices and order analytics, not from catalog CRUD — the module does not produce them and should
not promise them.

**`catalog-module`** — schema in `pgSchema('catalog')` with its own migrations and journal, CRUD
for products, catalogs and sections, inventory, bulk import, HTTP routes for both adapters, and
optional publishing to Meta Commerce.

Three decisions worth knowing:

- **Inventory is atomic at the database.** `consumeInventory` compiles to
  `UPDATE ... WHERE inventory >= quantity` and decides by affected rows. Read-then-write would let
  two concurrent orders for the last item both succeed. Covered by a concurrency test.
- **No queue for Meta sync, and that is a decision.** Catalog changes when an operator edits,
  tolerates minutes of delay and benefits from batching — a cron sweep over `syncStatus = 'pending'`
  covers it, recovers items a failed enqueue would lose, and spares consumers from running a broker.
  `retriable` returns to `pending` with no explicit backoff: the cron interval *is* the backoff.
- **Meta is off by default and invisible when off.** With `metaSync` disabled the publishing routes
  are not even mounted, and the module never imports `meta-catalog-provider` — the adapter lives in
  the host, so whoever only manages an internal catalog does not pull in a Graph API client. This is
  also why the trio is named `catalog-*` rather than `meta-catalog-*`.

**`module-http`** — the notification module carried 698 lines of generic HTTP plumbing; the catalog
module needed the same. Duplicating it would guarantee divergence, so it became a package: a
declarative route table with no framework types, a shared dispatcher, `fetch` and uWebSockets
adapters, OpenAPI generation and a uWS test harness.

Domain errors are recognised by shape (`{ statusCode, code, message }`) rather than `instanceof`,
so this package never has to depend on each module's contracts.
