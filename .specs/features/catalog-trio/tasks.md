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
- ✅ **T0.4** Fechar Q2 (`products-ui` vira `catalog-ui`?) e Q3 (importação síncrona ou por
      fila?). Ambas têm recomendação na §9 e **não bloqueiam** as Fases 1–3.

---

## Fase 1 — `catalog-module`: dados ✅
> 🤖 Modelo: `sonnet`

- ✅ **T1.1** Pacote + `database.types.ts` (`PgDatabase` genérico + `DrizzleMigrateFunction`
      injetado, molde de `meta-whatsapp-module`) + exports map.
- ✅ **T1.2** `schema/schema.ts` — `catalogs`, `sections`, `products` em `pgSchema('catalog')`
      com os índices da §4. Atenção ao que a spec justifica: `catalogId` e `sections.catalogId`
      nullable, soft delete nas duas entidades, `imageStorageKey` separado da URL.
- ✅ **T1.3** Índice **GIN** em `products.name` para a busca por texto — sem ele, `ILIKE` varre
      a tabela numa base de supermercado. Exige `pg_trgm`; a migration cria a extensão.
- ✅ **T1.4** Migrations pelo drizzle-kit **do pacote** + `runCatalogMigrations` com journal
      `catalog_migrations` fora do pgSchema (motivo em `meta-whatsapp-module/runMigrations.ts`).
- ✅ **T1.5** Repositories: `ProductRepository`, `CatalogRepository`, `SectionRepository`.
      Toda condição alcançável por requisição de usuário é **função pura exportada**, para o
      teste de isolamento travar a mesma função que a produção chama (padrão do
      `notification-module`).
- ✅ **T1.6** Teste de isolamento multiempresa por renderização de SQL (`PgDialect`), sem
      Postgres real.

---

## Fase 2 — `catalog-module`: comportamento ✅
> 🤖 Modelo: `sonnet` (T2.3 é 🧠 — concorrência)

- ✅ **T2.1** CRUD de catálogo e seção. `DeleteCatalog` recusa com produto dentro
      (`CatalogNotEmptyError`, 409).
- ✅ **T2.2** CRUD de produto + `ListProducts` paginado com busca e filtros. Código de barras
      único por empresa (`DuplicateBarcodeError`). Soft delete preserva o que pedido histórico
      referencia.
- ✅ **T2.3** 🧠 `ConsumeInventory` **transacional**: `UPDATE ... WHERE inventory >= quantity`
      com checagem de linhas afetadas, nunca read-then-write. **Teste de concorrência**: dois
      consumos simultâneos do último item, um falha com `InsufficientInventoryError`.
- ✅ **T2.4** `AdjustInventory` + derivação de `availability` quando
      `deriveAvailabilityFromInventory` está ligado. `onProductOutOfStock` dispara **na transição**
      para zero, não a cada venda.
- ✅ **T2.5** `UploadProductImage` via `ProductImageStoragePort`, guardando `imageStorageKey`.
- ✅ **T2.6** `BulkImportProducts`: parse, validação linha a linha e relatório com número da
      linha. Preço aceita `"19,90"` (planilha) e converte pela moeda do config.
- ✅ **T2.7** `createCatalogModule({ db, config, providers, hooks })` — valida config e falha
      **no boot** se `metaSync` estiver ligado sem `MetaCatalogSyncPort`.
- ✅ **T2.8** Suíte de comportamento + teste garantindo que `costPriceInCents` **não sai** na
      projeção destinada ao cliente final.

---

## Fase 3 — HTTP ✅
> 🤖 Modelo: `sonnet`

- ✅ **T3.1** Tabela de rotas declarativa (mesmo padrão do `notification-module`, já provado):
      método, path, escopo, schemas zod, handler puro. Nenhum tipo de framework.
- ✅ **T3.2** Adaptadores `./http/fetch` e `./http/uws` + **teste de contrato compartilhado**
      exigindo respostas idênticas nos dois.
- ✅ **T3.3** Teste de autorização por objeto: produto de outra empresa devolve 404, nunca 403.
- ✅ **T3.4** `./openapi` derivado da mesma tabela, com teste que quebra se rota nova ficar sem
      documentação.
- ✅ **T3.5** Rotas de sync **não são publicadas** quando `metaSync` está desligado — nenhuma
      rota nem coluna de publicação exposta a quem não publica.

---

## Fase 4 — Publicação na Meta ✅
> 🤖 Modelo: `sonnet` (T4.2 é 🧠)

- ✅ **T4.1** `SyncProductToMeta` e `SyncCatalogToMeta` agindo sobre o `MetaSyncOutcome`
      discriminado: `synced` grava `externalId`; `retriable` reenfileira com backoff; `permanent`
      marca `failed` com o motivo visível na UI, sem retry.
- ✅ **T4.2** 🧠 Salvar produto marca `pending` e **enfileira** — Graph API fora do ar não pode
      impedir cadastro. Worker consome; `QueuePort` injetado, nunca conexão própria.
- ✅ **T4.3** `RetryFailedSyncs` em lote, para o operador republicar depois de corrigir.
- ✅ **T4.4** Adaptador de exemplo sobre o `meta-catalog-provider` **no host**, não no módulo —
      documentado no README, para o módulo seguir sem importar nada da Meta.

---

## Fase 5 — `products-ui` e publicação
> 🤖 Modelo: `haiku` para T5.1, **`opus` obrigatório** para T5.3

- ⛔ **T5.1 BLOQUEADA por branch** — `products-ui` tem trabalho ativo em
      `feat/products-price-reference` (a versão de lá tem 235 linhas contra 158 na `main`, e o
      branch seguiu avançando durante esta sessão). Editar o mesmo arquivo aqui garantiria
      conflito. É mecânico: declarar a dependência e reexportar os tipos de catálogo, mantendo
      `PriceReference`, `PriceHistoryEntry` e `RelatedProduct` locais. **Fazer depois do merge.**
- ✅ **T5.2** README dos três pacotes novos (pt-BR, padrão do `fiscal-provider`) + changeset
      `catalog-trio.md` em inglês, com o porquê de cada decisão.
- ✅ **T5.3** **Gate de revisão com `opus`** — encontrou 4 defeitos, todos corrigidos:
  1. `CUSTOMER_FACING_PRODUCT_COLUMNS` estava definido, exportado e **nunca usado em query**. A
     proteção de margem existia só no mapeamento, que depende de o chamador lembrar do argumento.
     Agora `findByIdForCustomer` e `listForCustomer` fazem o `select` restrito de verdade, e o
     `lookup` usa essas leituras.
  2. Comentário do `toContract` afirmava "a coluna nem é lida do banco" — era falso.
  3. Cabeçalho do `authorization.test.ts` prometia cobrir vazamento de margem, e **nenhuma
     asserção cobria**. `costLeak.test.ts` fecha a lacuna, checando o nome real da coluna no
     banco (não a chave do objeto, que alguém poderia renomear achando que escondeu).
  4. Rotas do catálogo só tinham rodado no adaptador `fetch`. `uwsParity.test.ts` roda as rotas
     **reais** nos dois transportes — o contrato do `module-http` prova equivalência só com rotas
     sintéticas, e não cobria `listSections`, que lê query crua sem `querySchema`.

  Passaram sem correção: zero `process.env` nos três pacotes, zero import de Meta no módulo,
  migration sem `DROP`/`ALTER` destrutivo, índices únicos parciais com o `WHERE` correto.

---

## Fora de escopo, registrado

- **`items_batch` da Meta** (§6.1 da spec): o provider sincroniza item a item e não escala para
  supermercado. Muda a forma do provider, não do módulo — entra quando houver consumidor com esse
  volume.
- **`aliases` para linguagem natural**: é resolução do canal de conversa, não atributo de
  catálogo. Entra quando um segundo consumidor precisar.
- **Migração do QuickCart**: decisão separada (§7 da spec).


---

## Bloqueios para publicar

Nada foi publicado. Duas pendências, ambas de coordenação de branch, não de código:

1. **T5.1** — esperando `feat/products-price-reference` merjar.
2. **`notification-module` ainda tem a cópia local do encanamento HTTP.** O `module-http` nasceu
   em `feat/meta-catalog-trio`; migrar o notification exigiria as duas branches juntas. Enquanto
   isso, existem duas cópias — exatamente o que a extração queria evitar. A migração é mecânica:
   trocar os imports locais por `@adatechnology/module-http` e apagar `src/http/*` de lá.

Caminho para fechar: merjar as duas branches, um passe curto para as duas migrações, e aí
changeset de release.
