# @adatechnology/catalog-contracts

Tipos, schemas zod e portas do trio `catalog-*`. **Sem comportamento de runtime** — backend valida
com ele, frontend tipa as queries com ele, e mudança de contrato quebra os dois lados em
compile-time em vez de em produção.

Única dependência: `zod`.

## Instalação

```bash
bun add @adatechnology/catalog-contracts
```

## O que traz

| Área | Conteúdo |
|---|---|
| Entidades | `Product`, `Catalog`, `Section`, `PaginatedResponse` |
| Entrada | `createProductSchema`, `updateProductSchema`, `createCatalogSchema`, `listProductsQuerySchema`, … |
| Portas | `MetaCatalogSyncPort`, `ProductImageStoragePort`, `ProductSuggestionPort`, `CatalogProductLookup` |
| Eventos | 9 eventos de domínio + `CatalogHooks` |
| Erros | `CatalogError` e subclasses, com `statusCode` e `code` estáveis |

## Invariantes

- **`companyId` nunca entra em schema de corpo.** Vem do contexto autenticado do host.
- **Dinheiro é `integer` de centavos**, com `.int()` no zod — sem isso `19.99` vira preço.
- **Nenhum import de Meta.** A publicação é porta; quem só gerencia catálogo interno não carrega
  cliente de Graph API.
- `DEFAULT_META_SYNC` é `{ products: false, catalogs: false }`.

## `MetaSyncOutcome` é união discriminada

```ts
type MetaSyncOutcome =
  | { outcome: 'synced'; externalId: string }
  | { outcome: 'permanent'; errorCode: string; message: string }
  | { outcome: 'retriable'; errorCode: string; message: string }
```

Quem classifica é o **adaptador**, nunca o módulo: só ele conhece o vocabulário de erro do
provedor. O módulo reage ao discriminante — e é isso que evita retry infinito em erro definitivo.

## Fora do contrato, de propósito

`PriceReference`, `PriceHistoryEntry` e `RelatedProduct` vivem no `products-ui`. Vêm de NF-e e de
analytics de pedido — não são dado de catálogo, o módulo não os produz, e prometê-los aqui seria
contrato que ninguém cumpre.

## Licença

MIT © Ada Technology
