---
'@adatechnology/module-http': minor
'@adatechnology/catalog-module': minor
'@adatechnology/notification-module': minor
---

**Correção de segurança — escopo em rota administrativa.**

- `module-http`: rota `admin`/`service` sem `requiredScopes` agora exige que a identidade traga ao menos um escopo. Antes, qualquer sessão autenticada (inclusive com `scopes: []`) passava. Com `requiredScopes` declarado, continua valendo "basta um" e `403` sem ele.
- `catalog-module`: as rotas `admin` declaram escopo. `GET` aceita `catalog:read` ou `catalog:write`; mutações exigem `catalog:write` (`CATALOG_SCOPE`). Vocabulário do host via `createCatalogRoutes({ scopes: { read, write } })`.
- `notification-module`: rotas `admin` exigem `notification:admin`; a rota `service` de envio aceita `notification:send` ou `notification:admin` (`NOTIFICATION_SCOPE`). Vocabulário do host via `createNotificationRoutes({ scopes: { admin, service } })`.

**Impacto:** host que dependia do bug (identidade sem esses escopos operando rota administrativa) passa a receber `403`. Ao atualizar, o `authResolver` deve devolver os escopos acima a quem administra, ou o host passa `scopes` com o vocabulário dele.
