# CAT — Tasks

Spec: `.specs/features/catalog-trio/spec.md`
Gate ao fim de **cada** task: `pnpm --filter=<pacote> exec tsc --noEmit` + testes do pacote +
commit isolado (`model-economy.md` §3).

Worktree: `~/Documents/personal/adatechnology-catalog`, branch `feat/meta-catalog-trio`
(o nome do branch nasceu antes do rename; não vale renomear branch em uso).

---

## Fase 0 — Contrato ✅
> 🤖 Modelo: `opus` 🧠

- ✅ **T0.1** `catalog-contracts` extraído de `products-ui/src/providers/types.ts`: tipos,
      schemas zod, portas, erros e 9 eventos. `tsc` limpo, build emitindo.
- ✅ **T0.2** Rename `meta-catalog-*` → `catalog-*`, com a regra global corrigida (teste do
      prefixo em `pluggable-module.md` §2).
- ✅ **T0.3** Spec reescrita com o levantamento; Q1 (QuickCart) resolvida como "não migra".
- [ ] **T0.4** Fechar Q2 (`products-ui` vira `catalog-ui`?) e Q3 (importação síncrona ou por
      fila?). Ambas têm recomendação na §9 e **não bloqueiam** as Fases 1–3.

---

## Fase 1 — `catalog-module`: dados
> 🤖 Modelo: `sonnet`

- [ ] **T1.1** Pacote + `database.types.ts` (`PgDatabase` genérico + `DrizzleMigrateFunction`
      injetado, molde de `meta-whatsapp-module`) + exports map.
- [ ] **T1.2** `schema/schema.ts` — `catalogs`, `sections`, `products` em `pgSchema('catalog')`
      com os índices da §4. Atenção ao que a spec justifica: `catalogId` e `sections.catalogId`
      nullable, soft delete nas duas entidades, `imageStorageKey` separado da URL.
- [ ] **T1.3** Índice **GIN** em `products.name` para a busca por texto — sem ele, `ILIKE` varre
      a tabela numa base de supermercado. Exige `pg_trgm`; a migration cria a extensão.
- [ ] **T1.4** Migrations pelo drizzle-kit **do pacote** + `runCatalogMigrations` com journal
      `catalog_migrations` fora do pgSchema (motivo em `meta-whatsapp-module/runMigrations.ts`).
- [ ] **T1.5** Repositories: `ProductRepository`, `CatalogRepository`, `SectionRepository`.
      Toda condição alcançável por requisição de usuário é **função pura exportada**, para o
      teste de isolamento travar a mesma função que a produção chama (padrão do
      `notification-module`).
- [ ] **T1.6** Teste de isolamento multiempresa por renderização de SQL (`PgDialect`), sem
      Postgres real.

---

## Fase 2 — `catalog-module`: comportamento
> 🤖 Modelo: `sonnet` (T2.3 é 🧠 — concorrência)

- [ ] **T2.1** CRUD de catálogo e seção. `DeleteCatalog` recusa com produto dentro
      (`CatalogNotEmptyError`, 409).
- [ ] **T2.2** CRUD de produto + `ListProducts` paginado com busca e filtros. Código de barras
      único por empresa (`DuplicateBarcodeError`). Soft delete preserva o que pedido histórico
      referencia.
- [ ] **T2.3** 🧠 `ConsumeInventory` **transacional**: `UPDATE ... WHERE inventory >= quantity`
      com checagem de linhas afetadas, nunca read-then-write. **Teste de concorrência**: dois
      consumos simultâneos do último item, um falha com `InsufficientInventoryError`.
- [ ] **T2.4** `AdjustInventory` + derivação de `availability` quando
      `deriveAvailabilityFromInventory` está ligado. `onProductOutOfStock` dispara **na transição**
      para zero, não a cada venda.
- [ ] **T2.5** `UploadProductImage` via `ProductImageStoragePort`, guardando `imageStorageKey`.
- [ ] **T2.6** `BulkImportProducts`: parse, validação linha a linha e relatório com número da
      linha. Preço aceita `"19,90"` (planilha) e converte pela moeda do config.
- [ ] **T2.7** `createCatalogModule({ db, config, providers, hooks })` — valida config e falha
      **no boot** se `metaSync` estiver ligado sem `MetaCatalogSyncPort`.
- [ ] **T2.8** Suíte de comportamento + teste garantindo que `costPriceInCents` **não sai** na
      projeção destinada ao cliente final.

---

## Fase 3 — HTTP
> 🤖 Modelo: `sonnet`

- [ ] **T3.1** Tabela de rotas declarativa (mesmo padrão do `notification-module`, já provado):
      método, path, escopo, schemas zod, handler puro. Nenhum tipo de framework.
- [ ] **T3.2** Adaptadores `./http/fetch` e `./http/uws` + **teste de contrato compartilhado**
      exigindo respostas idênticas nos dois.
- [ ] **T3.3** Teste de autorização por objeto: produto de outra empresa devolve 404, nunca 403.
- [ ] **T3.4** `./openapi` derivado da mesma tabela, com teste que quebra se rota nova ficar sem
      documentação.
- [ ] **T3.5** Rotas de sync **não são publicadas** quando `metaSync` está desligado — nenhuma
      rota nem coluna de publicação exposta a quem não publica.

---

## Fase 4 — Publicação na Meta
> 🤖 Modelo: `sonnet` (T4.2 é 🧠)

- [ ] **T4.1** `SyncProductToMeta` e `SyncCatalogToMeta` agindo sobre o `MetaSyncOutcome`
      discriminado: `synced` grava `externalId`; `retriable` reenfileira com backoff; `permanent`
      marca `failed` com o motivo visível na UI, sem retry.
- [ ] **T4.2** 🧠 Salvar produto marca `pending` e **enfileira** — Graph API fora do ar não pode
      impedir cadastro. Worker consome; `QueuePort` injetado, nunca conexão própria.
- [ ] **T4.3** `RetryFailedSyncs` em lote, para o operador republicar depois de corrigir.
- [ ] **T4.4** Adaptador de exemplo sobre o `meta-catalog-provider` **no host**, não no módulo —
      documentado no README, para o módulo seguir sem importar nada da Meta.

---

## Fase 5 — `products-ui` e publicação
> 🤖 Modelo: `haiku` para T5.1, **`opus` obrigatório** para T5.3

- [ ] **T5.1** `products-ui` declara `@adatechnology/catalog-contracts` e reexporta os tipos de
      lá, apagando a cópia local. `PriceReference`, `PriceHistoryEntry` e `RelatedProduct`
      **continuam locais** — são enriquecimento externo, não catálogo. Mudança de tipo, nenhum
      componente muda.
- [ ] **T5.2** README de cada pacote + changesets.
- [ ] **T5.3** **Gate de revisão com `opus`**: checklist da §10 da spec, caça a bug de
      concorrência no estoque, auditoria de multiempresa e de vazamento de custo.

---

## Fora de escopo, registrado

- **`items_batch` da Meta** (§6.1 da spec): o provider sincroniza item a item e não escala para
  supermercado. Muda a forma do provider, não do módulo — entra quando houver consumidor com esse
  volume.
- **`aliases` para linguagem natural**: é resolução do canal de conversa, não atributo de
  catálogo. Entra quando um segundo consumidor precisar.
- **Migração do QuickCart**: decisão separada (§7 da spec).
