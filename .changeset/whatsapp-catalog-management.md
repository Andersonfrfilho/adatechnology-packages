---
"@adatechnology/whatsapp-provider": minor
---

Add real catalog-container management to WhatsAppCatalogProvider: `listCatalogs`, `createCatalog`, `updateCatalog`, `deleteCatalog`, plus a new `businessId` config field required for `createCatalog`. `createProduct`/`createProductSet` now accept a per-call `catalogId` override instead of always using the single configured catalog.
