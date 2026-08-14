---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
'@adatechnology/products-ui': minor
---

Add brand, unit size, aisle and aliases to catalog products

A grocery catalog needs four things this trio did not carry: the manufacturer,
the package size printed on the label, where the item sits in a physical store,
and the names customers actually use for it. Hosts were keeping those in their
own tables next to the module — which is the shape that makes a shared module
pointless.

All four are optional and additive. `brand`, `unitSize` and `aisle` are nullable
text; `aliases` is a `text[]` defaulting to `'{}'` — not null, because product
search now does `aliases && ARRAY[…]` and `NULL && …` yields NULL, which would
drop the row from the result instead of just failing to match the alias.

Product search widens accordingly: `name` and `brand` match by substring (both
backed by trigram GIN indexes), aliases match whole and lowercased, since an
alias is already the short term the customer typed. Existing hosts see no change
— the new columns are empty for them.

`sectionId` is unchanged and still means catalog grouping (in restaurants, the
production station). `aisle` is shelf address, and the two are not
interchangeable.

`products-ui` gains `BRAND`, `UNIT_SIZE`, `AISLE` and `ALIASES` in
`PRODUCT_OPTIONAL_FIELD`, drawn by both `ProductForm` and `ProductList` (aliases
only in the form — several per product, of unpredictable length, they would push
price and stock off screen). None are in `DEFAULT_PRODUCTS_CONFIG.fields`, so a
restaurant or service catalog keeps the screens it has today.

`ProductsConfig.fields` now also accepts `{ form, list }`, because the two
surfaces do not want the same fields — a kitchen spec sheet belongs in the form
and not in the table. The plain array keeps working and means "the same on both",
so no host has to change anything. `useIsProductFieldEnabled(surface)` takes an
optional surface; without it, a field enabled anywhere counts as enabled.

`fields` also accepts a per-field table, which is the shape that answers "what
does this host do with brand?" in one place instead of looking the field name up
in three parallel lists:

```ts
fields: {
  brand: { required: true, label: 'Fabricante' },
  aisle: { visible: { list: false } },
  description: { visible: false },
}
```

Declaring the field is what shows it — `{}` means "show it, the default way", so
a configuration does not have to open with `visible: true` noise. Core and
vertical fields have opposite defaults on purpose: `description`, `catalog` and
`image` were on screen before any of this existed and stay until hidden, while
`brand` or `aisle` stay off until declared, or a services catalog would show
empty columns. `name` and `price` cannot be hidden at all.

Two more knobs on `ProductsConfig`, both optional and both presentation-only:

`labels` renames any field on the form, the table, or each separately (same
`{ form, list }` shape as `fields`). A grocery calls it "Corredor", a warehouse
calls it "Setor", and forking the component over a noun is a bad trade. Defaults
differ per surface on purpose — the form spells "Embalagem" out, the column header
abbreviates to "Emb.".

`requiredFields` marks extra fields as required in the form, beyond `name` and
`priceInCents`, which are always required and cannot be turned off from the UI —
the API rejects those anyway, and letting the screen accept them only moves the
failure. A field disabled in `fields` is never required: demanding a field nobody
can see would block saving with no visible cause. This is form ergonomics, not a
business rule — the API is still the one that validates, and bulk import does not
pass through this screen at all.

Migration `0001_product_retail_fields` is additive and safe to apply online.
