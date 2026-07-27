---
'@adatechnology/meta-catalog-provider': patch
'@adatechnology/meta-graph-core': patch
---

Expose `inventory` on catalog products

The Meta catalog accepts a quantity per item for any vertical, and derives the
item's availability from it, but the provider never sent or read the field — a
consumer tracking stock had to keep flipping `availability` by hand and the two
would drift.

`CatalogProductInput.inventory` is optional, so omitting it keeps the previous
behaviour exactly: availability stays whatever the consumer sets. `getProduct`
now requests and returns the field as well.
