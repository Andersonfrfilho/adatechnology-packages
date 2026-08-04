# CLAUDE.md — @adatechnology/catalog-contracts

## Propósito

Fonte única de tipos, schemas zod e portas do trio `catalog-*`. **Sem comportamento de runtime.**
Backend valida com ele, frontend tipa as queries com ele: mudança de contrato quebra os dois lados
em compile-time, nunca em produção.

Estes tipos **já existiam**, em `products-ui/src/providers/types.ts` — bem desenhados, mas presos
no frontend, onde o backend não conseguia tipar contra eles. Extrair foi o que fechou o trio.

Spec: `.specs/features/catalog-trio/spec.md`.

## Invariantes (quebrar = code review reprovado)

- **`companyId` nunca entra em schema de corpo de requisição.** Vem do contexto autenticado
  (`database.md`, multiempresa).
- **Dinheiro é `integer` de centavos**, com `.int()` no zod — sem isso, `19.99` vira preço por
  engano.
- **Nenhum import de Meta.** A publicação é `MetaCatalogSyncPort`; quem só gerencia catálogo
  interno não carrega cliente de Graph API.
- **`DEFAULT_META_SYNC` é `{ products: false, catalogs: false }`.** A Meta é integração opcional,
  e é por isso que o trio se chama `catalog-*` e não `meta-catalog-*` (teste do prefixo,
  `pluggable-module.md` §2).
- Única dependência de runtime: `zod`.

## Fora do contrato, de propósito

`PriceReference`, `PriceHistoryEntry` e `RelatedProduct` continuam no `products-ui`. Vêm de NF-e e
de analytics de pedido — não são dado de catálogo, o módulo não os produz, e prometê-los aqui
seria contrato que ninguém cumpre.

## `MetaSyncOutcome` é discriminado

`synced` | `permanent` | `retriable`. Mesmo desenho do `DeliveryAttemptResult` do trio de
notificações, e pelo mesmo motivo: **só o adaptador conhece o vocabulário de erro do provedor**, e
o módulo reage ao discriminante.

## `CatalogProductLookup`

Projeção que o `meta-whatsapp-module` pluga no `CatalogPort` dele. Os dois módulos continuam sem
se importar — a costura acontece no produto. É a projeção de **cliente**: sem `costPriceInCents`.

## Comandos

```bash
pnpm --filter @adatechnology/catalog-contracts run check
pnpm --filter @adatechnology/catalog-contracts run test
pnpm --filter @adatechnology/catalog-contracts run build
```
