---
'@adatechnology/products-ui': minor
---

Make the product model configurable, and publish the package

The package modelled one vertical: every product had a unit, a barcode, a cost
price, a section and a preparation time, prices were decimal strings formatted
as `pt-BR`/`BRL` in three hardcoded places, and there was nowhere to show
whether an item had reached the Meta catalog. A consumer selling anything other
than food had to either accept empty columns it cannot fill or fork the
components.

The mandatory core is now name, price, image, catalog, active, sort order and
availability. Everything else is an optional field the consumer switches on
through `ProductsConfig.fields`, and the form and the list only render what is
switched on. Defaults keep the previous behaviour, so an existing consumer sees
no change.

Money moved to integer cents (`priceInCents`, `costPriceInCents`) with
`currency` and `locale` coming from the config. Decimal strings could not round
trip a price without a float round, and the margin shortcut compounded the error.
`formatBRL`/`formatMargin`/`parseCurrency` are replaced by `formatMoney`,
`maskMoneyInput`, `applyMarginToCost` and `formatMarginPercent` in `lib/money`.

Catalog sync state (`syncStatus`, `syncError`, `externalId`) enters the core
type and the list renders it as a column, with the Graph API error in the
badge's tooltip — it is inherent to a Meta catalog, not a per-vertical extra.
`syncStatus: null` means the host does not sync at all, distinct from `pending`.

Public shapes are `type` + `readonly` instead of mutable `interface`, matching
the rest of the monorepo, and the package leaves `0.0.0`.

BREAKING for anyone already consuming the workspace version: `price` →
`priceInCents` (number), `costPrice` → `costPriceInCents`, `inventory` may be
`null`, and `useProducts()` now requires the provider to be mounted with a
`config` (or to accept the default).
