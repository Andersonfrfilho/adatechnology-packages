# Tasks — Trio plugável `customer`

Referência: `.specs/features/customer-trio/spec.md`.

> ✅ **D1 e D2 fechadas** — campo customizado em `attributes`, com catálogo declarado, do mesmo jeito
> que `documents`. A Fase 1 está liberada.

## Fase 0 — Decisão
> 🤖 Modelo: `opus` 🧠

- [x] **T0.1** ✅ **D1**: campo customizado em `attributes` com catálogo declarado (`name`, `label`,
      `type`, `options`, `required`, `encrypted`). Descartadas: tabela satélite do host (devolve a
      cada produto repositório, migration e formulário próprios) e colunas geradas por config
      (migration no pacote a cada campo novo).
- [x] **T0.2** ✅ **D2**: o `rating` do Sakura é campo customizado do tipo `number`.
- [ ] **T0.3** Registrar D1 e D2 como ADR em `docs/adr/`, com o custo assumido: filtrar e ordenar
      por campo em jsonb é mais caro que por coluna, e o remédio é índice de expressão pontual,
      quando medido.

## Fase 1 — `customer-contracts`
> 🤖 Modelo: `sonnet`

- [ ] **T1.1** Tipos e schemas Zod: `Customer`, `CustomerDocument`, `CustomerModuleConfig`, entradas
      de use-case. Sem I/O, sem dependência de banco.
      **Aceite:** `bun run check` limpo; nenhum import de driver.
- [ ] **T1.2** Portas: `CustomerRepositoryPort`, `DocumentCipherPort` (cifra do host), e os erros
      de domínio.
      **Aceite:** teste que prova que `documents` recusa `name` vazio e `value` vazio.

## Fase 2 — `customer-module`
> 🤖 Modelo: `sonnet` (T2.2 é 🧠 — validar com `opus`)

- [ ] **T2.1** `pgSchema('customer')`, as **quatro** tabelas (`customers`, `customer_phones`,
      `customer_documents`, `customer_addresses`) e migrations com journal próprio
      (`customer_migrations`, fora do schema — mesmo raciocínio do `user-module`).
      **Aceite:** migrations **convergentes** (`IF NOT EXISTS`, bloco anônimo em constraint), com o
      teste de forma que o `notification-module@0.1.1` passou a ter.
- [ ] **T2.2** 🧠 Índice único **parcial** sobre `customer_phones (company_id, number) WHERE
      is_whatsapp`, e `SetWhatsAppPhone` desmarcando o anterior na mesma transação.
      **Aceite:** o mesmo número convive como telefone comum de dois clientes e COLIDE como
      WhatsApp; teste de concorrência prova que duas escritas simultâneas do mesmo número criam um
      cliente só; no modo multi o mesmo número é cliente de duas empresas.
- [ ] **T2.2b** `UpsertByPhone` em UMA consulta com o telefone em tabela filha, e criação de cliente
      e telefone na mesma transação.
      **Aceite:** teste que conta as idas ao banco no caminho quente.
- [ ] **T2.3** Cifra de documento por `config.encryptedDocuments`, com chave do host.
      **Aceite:** teste que lê a linha crua do banco e prova que o valor não está lá em claro.
- [ ] **T2.4** Use-cases: `CreateCustomer`, `UpsertByPhone`, `UpdateCustomer`, `SetDocument`,
      `GetCustomer`, `LinkToUser`, `SoftDeleteCustomer`.
      **Aceite:** `UpsertByPhone` resolve em UMA consulta — é o caminho quente do fluxo de conversa.
- [ ] **T2.5** `customer.settings` por empresa, com os **dois** catálogos (documentos e campos
      customizados), `GetSettings`/`UpdateSettings` e trilha de auditoria na alteração.
      **Aceite:** `name` é imutável nos dois catálogos; nada cifrado sai do catálogo pela tela;
      trocar `type` de campo já usado é recusado — testes para os três.
- [ ] **T2.5b** Validação de `attributes` contra o catálogo: tipo, obrigatoriedade e opção fora da
      lista. Cifra do que o catálogo declarar cifrado.
      **Aceite:** teste que lê a linha crua e prova que o valor cifrado não está em claro no jsonb.
- [ ] **T2.6** `ListCustomers` paginada, com busca por nome e por **qualquer** telefone, e os
      índices de §4.6: `pg_trgm` na migration, GIN trigram em nome e número, B-tree parcial para
      ordenação, GIN `jsonb_path_ops` em `attributes`.
      **Aceite:** teste com ≥10 mil clientes usando `EXPLAIN` — a asserção é sobre o PLANO não ser
      varredura sequencial, não sobre cronômetro, que varia com a máquina.
- [ ] **T2.6b** Normalização do termo de busca de telefone para dígitos.
      **Aceite:** `(16) 99305-6772` acha `5516993056772`.
- [ ] **T2.6d** 🧠 Índices dinâmicos: marcar um campo como `filterable` enfileira
      `CREATE INDEX CONCURRENTLY` de expressão, com o cast do `type` declarado; desmarcar remove.
      **Aceite:** roda em job e fora de transação (`CONCURRENTLY` não vive dentro de uma);
      `name` fora de `^[a-z][a-z0-9_]{0,40}$` é recusado no contrato — teste com `renda"; DROP`;
      o nono campo filtrável é recusado com a razão dita; `EXPLAIN` prova que a faixa passa a usar
      o índice depois de criado.
- [ ] **T2.6e** `search_vector` mantido por trigger com os campos marcados `searchable`.
      **Aceite:** marcar `searchable` num campo passa a encontrá-lo na busca livre, sem DDL.
- [ ] **T2.6c** 🧠 Índice cego para documento cifrado: HMAC-SHA256 do valor normalizado, com chave
      do host, na coluna `fingerprint` ao lado do valor cifrado, com B-tree em `(name, fingerprint)`.
      **Aceite:** busca por CPF exato encontra; o valor cru não aparece na coluna nem no índice;
      girar a chave do HMAC é procedimento escrito, não improviso.
- [ ] **T2.6f** `uniqueDocuments` gera índice único parcial por `name` — sobre `fingerprint` quando
      cifrado, sobre `value` quando não.
      **Aceite:** o segundo cliente com o mesmo CPF é recusado pelo BANCO, não pela aplicação.
- [ ] **T2.7** `createCustomerRoutes` (`ModuleRouteTable`), com escopo declarado.
      **Aceite:** o `requiredScopes` de cada rota está no teste — a lição do `user:admin`, que o
      host não tinha como adivinhar.

## Fase 3 — `customers-ui`
> 🤖 Modelo: `sonnet`

- [ ] **T3.1** Listagem: busca, ordenação, filtros com seleção múltipla, limpar filtros e estado na
      URL (`web.md` §7).
      **Aceite:** telefone **mascarado** por padrão; a máscara é prop, não constante.
- [ ] **T3.2** Ficha: telefones, endereços e documentos **editáveis** — acrescentar, remover,
      escolher principal e marcar qual número é o do WhatsApp.
      **Aceite:** a tela impede deixar zero telefones de WhatsApp; sem a porta `ordersOf`, a seção
      de pedidos não é desenhada, com teste.
- [ ] **T3.2b** Campos customizados desenhados a partir do catálogo, por tipo.
      **Aceite:** acrescentar um campo `select` na configuração faz a ficha renderizá-lo sem
      nenhuma mudança de código.
- [ ] **T3.3** Página de configuração: os dois catálogos, interruptor de máscara, e a config
      de boot exibida como **somente leitura** e marcada como tal.
      **Aceite:** escopo `admin` apenas; a página some quando a `CustomerApi` não traz
      `updateSettings`, com teste.
- [ ] **T3.4** Rótulos por `labels`, como no `user-ui`.
      **Aceite:** nenhum texto fixo em português dentro de componente.

## Fase 4 — Adoção no QuickCart (o menor risco: não tem tela hoje)
> 🤖 Modelo: `sonnet`

- [ ] **T4.1** Migration de **expansão**: cria `customer.customers` e copia as linhas de
      `public.customers`, com `user_id` → `external_user_id`.
      **Aceite:** teste que conta as linhas antes e depois e compara telefone a telefone. **Nenhum
      cliente pode sumir.**
- [ ] **T4.2** Host passa a ler e escrever pelo pacote; a tabela antiga fica intacta.
      **Aceite:** o fluxo de conversa continua criando cliente com nome, verificado ponta a ponta.
- [ ] **T4.3** Tela `/admin/clientes` no menu, com recorte por papel.
      **Aceite:** separador e motorista não veem o item nem alcançam a rota.
- [ ] **T4.4** Migration de **contração**, só depois de produção estável.
      **Aceite:** plano de rollback escrito antes de rodar.

## Fase 5 — Adoção no Sakura (valida multiempresa e a tela)
> 🤖 Modelo: `sonnet`

- [ ] **T5.1** Expansão preservando `establishment_id` → `company_id`, `document`/`birth_date` →
      `documents`, `rating` → conforme D2.
      **Aceite:** contagem por estabelecimento idêntica antes e depois.
- [ ] **T5.2** Trocar a tela de 903 linhas pela do pacote.
      **Aceite:** as quatro seções continuam; nenhuma funcionalidade perdida, listada uma a uma.

## Fase 6 — Adoção no Financiamento (por último, PII cifrada)
> 🤖 Modelo: `opus` 🧠 — CPF e renda de gente real

- [ ] **T6.1** Expansão com recifra: CPF e CNPJ saem de coluna cifrada e entram em `documents`
      cifrados, sem passar por texto claro em disco ou log.
      **Aceite:** teste que prova que o valor em claro não aparece em nenhuma linha nem em log.
- [ ] **T6.2** Renda, estado civil, cidade e co-participante conforme D1.
- [ ] **T6.3** `deleted_at` preservado — cliente excluído continua excluído.
      **Aceite:** contagem de ativos e de excluídos idêntica antes e depois.

## Guard-rails de toda task

- `bun run check` e a suíte do pacote verdes
- Commit isolado por task, para rollback barato
- Nenhum telefone, documento ou renda em log, em nenhum nível (`security.md` §1)
