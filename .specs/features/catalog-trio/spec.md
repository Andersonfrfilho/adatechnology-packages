# Spec — Trio plugável `catalog`

Gerenciamento de catálogo e de produtos como capacidade reutilizável, com publicação na Meta
Commerce como integração **opcional**.

Regra de referência: `~/.claude/rules/rules/packages/pluggable-module.md`.
Companheira: `.specs/features/meta-whatsapp-trio/spec.md` — o canal pluga este catálogo por porta.

> **Status:** 🚧 `catalog-contracts` entregue; `catalog-module` desenhado aqui, não implementado.
> Revisada em 2026-08-02, depois de levantar o que existe de fato no código.

---

## 1. O que mudou desde a versão anterior desta spec

A versão original desenhou um trio do zero e listou três `[NEEDS CLARIFICATION]`. O levantamento
mostrou que boa parte da dúvida não existia mais:

| Suposição da spec antiga | Realidade medida |
|---|---|
| O trio precisa ser extraído do `financiamento-imobiliario-bot` | O contrato **já estava escrito**, em `products-ui/src/providers/types.ts` — bem desenhado, mas preso no frontend, onde o backend não conseguia tipar contra ele |
| A UI nasceria como `meta-catalog-ui` | Já existe como **`products-ui`** (`0.1.0-rc.0`): `CatalogList`, `ProductList`, `ProductForm`, `BulkImport`, `ImageUpload` |
| O trio se chamaria `meta-catalog-*` | **Renomeado para `catalog-*`** — ver §2 |
| Q1: como reconciliar com o catálogo do QuickCart | **Resolvida: não reconcilia agora** — ver §7 |

**Estado real:**

| Peça | Situação |
|---|---|
| `@adatechnology/catalog-contracts` | ✅ **entregue** (`0.1.0-rc.0`) — tipos, schemas zod, portas, erros, 9 eventos |
| `@adatechnology/catalog-module` | ❌ desenhado nesta spec |
| `@adatechnology/products-ui` | ⚠️ existe, mas tipa contra cópia local em vez do contracts (§8) |
| `@adatechnology/meta-catalog-provider` | ✅ existe (`0.2.0-rc.2`) — SDK da Meta Commerce, **mantém o prefixo** |

---

## 2. Por que `catalog-*` e não `meta-catalog-*`

Decisão do usuário, e a regra global foi corrigida junto — a §2 do `pluggable-module.md` ganhou o
**teste do prefixo**, porque ela mesma se contradizia: dizia que catálogo "é uma capacidade
própria" e logo em seguida o nomeava com prefixo de fornecedor.

O critério: **a capacidade existe sem o fornecedor?** Cadastrar produto, precificar, organizar em
catálogo e controlar estoque funciona inteiro sem a Meta. Publicar na Meta Commerce é integração
opcional atrás de `MetaCatalogSyncPort`, e `DEFAULT_META_SYNC` é `{ products: false, catalogs:
false }`. Chamar o módulo de `meta-catalog-module` faria toda vertical que não vende por WhatsApp
achar que precisa da Meta para gerenciar o próprio catálogo.

O `meta-catalog-provider` mantém o nome: ele **é** cliente da Graph API.

---

## 3. Anatomia

```text
packages/backend/
├── catalog-contracts/       @adatechnology/catalog-contracts        ✅ entregue
├── catalog-module/          @adatechnology/catalog-module           ← esta spec
└── meta-catalog-provider/   @adatechnology/meta-catalog-provider    ✅ existe (SDK da Meta)
packages/frontend/
└── products-ui/             @adatechnology/products-ui              ⚠️ passa a tipar contra o contracts
```

`pgSchema('catalog')`, journal `catalog_migrations`.

O módulo **não importa** o `meta-catalog-provider`: a publicação entra por `MetaCatalogSyncPort`,
e quem só gerencia catálogo interno não carrega cliente de Graph API.

---

## 4. Modelo de dados — `pgSchema('catalog')`

`varchar` em vez de ENUM (`code-standart.md` §8), `companyId` em toda tabela vindo do contexto
autenticado, PK UUID.

| Tabela | Colunas relevantes | Índices |
|---|---|---|
| `catalogs` | `companyId`, `name`, `description`, `active`, `sortOrder`, `externalId`, `syncStatus`, `syncError`, `deletedAt` | uniq `(companyId, name)` where not deleted · `(companyId, active, sortOrder)` |
| `sections` | `companyId`, `name`, `catalogId` (**nullable**), `sortOrder` | uniq `(companyId, catalogId, name)` |
| `products` | `companyId`, `catalogId`, `sectionId`, `name`, `description`, `priceInCents`, `costPriceInCents`, `unit`, `barcode`, `imageUrl`, `imageStorageKey`, `inventory`, `active`, `sortOrder`, `availability`, `preparationTimeMinutes`, `preparationInstructions`, `externalId`, `syncStatus`, `syncError`, `deletedAt` | uniq parcial `(companyId, barcode)` where barcode not null · `(companyId, catalogId, sortOrder)` · `(companyId, syncStatus)` · GIN em `name` |

**Decisões do schema, com o porquê:**

- **`sections.catalogId` é nullable** — em restaurante a seção é o posto de produção (cozinha,
  bar, chapa) e o mesmo posto atende itens de categorias diferentes. Amarrar seção a catálogo
  obrigaria a duplicar cada seção por categoria só para exibi-la.
- **`products.catalogId` é nullable** — produto sem catálogo é rascunho válido (cadastrado pelo
  leitor de código de barras antes de ser classificado). `NOT NULL` forçaria um catálogo
  "Sem categoria" fantasma, que é o que o QuickCart tem hoje.
- **Soft delete em produto e catálogo** — pedido histórico referencia produto; apagar de verdade
  quebraria o histórico ou exigiria `ON DELETE SET NULL`, perdendo o nome do item vendido.
- **`imageStorageKey` além de `imageUrl`** — a URL pode ser assinada e expirar; a chave é o que
  permite reemitir ou apagar o objeto no bucket.
- **`costPriceInCents` é dado de margem.** Não sai em nenhuma projeção destinada ao cliente final
  (`CatalogProductLookup`), só na de administração.
- **Índice GIN em `name`** — a busca do `ProductList` é por texto e a base de um supermercado passa
  de dezenas de milhares de itens; `ILIKE '%termo%'` sem índice varre a tabela.

**Sem `aliases`.** O QuickCart tem `aliases text[]` para casar linguagem natural no WhatsApp
("me vê um leite"). Isso é resolução de linguagem **do canal de conversa**, não atributo de
catálogo — entra no trio quando um segundo consumidor precisar, e não antes (§1 da regra, não
extrair por antecipação).

---

## 5. Use-cases

| Grupo | Use-cases |
|---|---|
| Produto | `CreateProduct`, `UpdateProduct`, `DeleteProduct` (soft), `GetProduct`, `ListProducts`, `SetProductAvailability` |
| Catálogo | `CreateCatalog`, `UpdateCatalog`, `DeleteCatalog`, `ListCatalogs` |
| Seção | `CreateSection`, `UpdateSection`, `DeleteSection`, `ListSections` |
| Estoque | `AdjustInventory`, `ConsumeInventory` |
| Imagem | `UploadProductImage` (via `ProductImageStoragePort`) |
| Lote | `BulkImportProducts` |
| Meta | `SyncProductToMeta`, `SyncCatalogToMeta`, `RetryFailedSyncs` |

**Regras que o módulo carrega:**

1. **Disponibilidade derivada do estoque** quando `deriveAvailabilityFromInventory` está ligado:
   `inventory === 0` → `out of stock`. Desligado, é decisão manual — o caso de quem vende sob
   encomenda e não quer sumir do catálogo por estar zerado.
2. **`ConsumeInventory` é transacional e recusa saldo negativo.** Dois pedidos simultâneos do
   último item não podem ambos passar: `UPDATE ... WHERE inventory >= quantity` com checagem de
   linhas afetadas, **nunca read-then-write**.
3. **Transição para zero dispara `onProductOutOfStock` uma vez**, não a cada venda — é gatilho de
   reposição, e repetir viraria ruído.
4. **Excluir catálogo com produto dentro é recusado** (`CatalogNotEmptyError`, 409). Mover os itens
   é decisão do operador.
5. **Código de barras é único por empresa** — dois GTIN iguais quebram a busca por leitor.
6. **Sync com a Meta nunca bloqueia o salvamento.** Salvar marca `syncStatus: 'pending'` e
   enfileira; Graph API fora do ar não pode impedir cadastro.

---

## 6. Publicação na Meta

`MetaSyncOutcome` discriminado — `synced` | `permanent` | `retriable` — no mesmo desenho do
`DeliveryAttemptResult` do trio de notificações, e pelo mesmo motivo: **só o adaptador conhece o
vocabulário de erro do provedor**, e o módulo reage ao discriminante.

`RetryFailedSyncs` existe porque erro permanente costuma ser corrigível pelo operador (imagem fora
do padrão, descrição vazia): depois de editar, ele republica em lote em vez de item a item.

### 6.1 Lacuna herdada: sem `items_batch`

O `meta-catalog-provider` sincroniza **item a item**. Para catálogo de supermercado (dezenas de
milhares de SKUs) isso não escala — a Meta oferece `items_batch` justamente para isso, e a
referência da API está em `packages/backend/meta-business/catalog/readme.md`.

**Não entra nesta versão:** o primeiro consumidor não tem esse volume, e `items_batch` muda a
forma do provider, não do módulo. Fica registrado como o que arrebentaria primeiro se o QuickCart
publicasse o catálogo dele na Meta.

---

## 7. ✅ Q1 resolvida — o QuickCart não migra agora

Levantado no schema real (`apps/api-quickcart/src/infra/database/schema/products.ts`):

| `catalog-module` prevê | QuickCart tem |
|---|---|
| `catalogId` nullable | `categoryId` **NOT NULL**, FK para `categories` |
| `active` | `isAvailable` |
| `inventory` | `stockQuantity` |
| `costPriceInCents`, `sectionId`, `sortOrder`, `preparationTime*`, `externalId`, `syncStatus` | não existem |
| — | **`aliases text[]`**, `brand`, `unitSize` |

Os `aliases` alimentam o casamento por linguagem natural do bot e o `unmatched-demands`. Migrar
colocaria esse mecanismo em risco por um ganho que o QuickCart não pediu.

**Decisão:** o módulo nasce autônomo. A migração do QuickCart vira decisão separada, com o módulo
pronto para comparar — e provavelmente só se justifica quando ele precisar de algo que hoje não
tem (custo, seção, publicação na Meta).

---

## 8. `products-ui` passa a tipar contra o contracts

Hoje tem cópia local dos tipos. Depois do módulo:

- Declara `@adatechnology/catalog-contracts` como dependência e reexporta os tipos de lá.
- **Continuam locais** os tipos que não são catálogo: `PriceReference`, `PriceHistoryEntry` e
  `RelatedProduct` vêm de NF-e e de analytics de pedido, não de CRUD de catálogo. O módulo não os
  produz e não deve prometê-los.
- É mudança de tipo, não de comportamento — nenhum componente muda.

---

## 9. Decisões abertas

**Q2. O `products-ui` vira `catalog-ui`?**
→ *Recomendação:* **não renomear agora.** O nome descreve bem o que ele faz, já está publicado, e
renomear pacote publicado é major com atualização em todo consumidor. Reavaliar se ganhar telas
que não são de produto.

**Q3. Importação em lote: síncrona ou por fila?**
→ *Recomendação:* **síncrona até 500 linhas, fila acima disso.** Planilha de mercado passa de
10 mil itens e travaria a requisição; mas exigir fila para importar 30 produtos obrigaria todo
consumidor a ter broker. O corte por tamanho atende os dois sem forçar infraestrutura.

---

## 10. Critérios de aceite

- [ ] `catalog-module` publicado com `pgSchema('catalog')` e journal `catalog_migrations`
- [ ] Zero `process.env` dentro do pacote
- [ ] Zero import de `meta-catalog-provider` ou de qualquer coisa da Meta no módulo
- [ ] Módulo funciona inteiro com `metaSync` desligado — nenhuma rota nem coluna de sync exposta
- [ ] `ConsumeInventory` com **teste de concorrência**: dois consumos simultâneos do último item,
      um falha
- [ ] `costPriceInCents` ausente da projeção destinada ao cliente final
- [ ] Soft delete preserva produto referenciado por pedido histórico
- [ ] Rotas prontas nos dois adaptadores (`fetch` e `uws`) com teste de contrato compartilhado —
      mesmo padrão já provado no `notification-module`
- [ ] Teste de isolamento multiempresa por renderização de SQL
- [ ] `products-ui` tipando contra o contracts, sem cópia local dos tipos de catálogo
- [ ] Revisão final com `opus` antes de publicar

---

## 11. Modelos por etapa (`model-economy.md`)

| Etapa | Modelo |
|---|---|
| Esta spec e o desenho do schema | `opus` 🧠 |
| `catalog-contracts` | ✅ feito |
| Schema, migrations e repositories | `sonnet` |
| Use-cases de CRUD | `sonnet` |
| Estoque transacional e sync com a Meta | `sonnet` 🧠 (concorrência) |
| Rotas e adaptadores | `sonnet` |
| `products-ui` tipando contra o contracts | `haiku` |
| Revisão final | `opus` |
