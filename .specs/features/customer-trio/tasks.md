# Tasks — Trio plugável `customer`

Referência: `.specs/features/customer-trio/spec.md`.

> ⛔ **Nada começa antes de D1 fechar.** Ela decide onde moram renda, estado civil e `rating`, e
> muda o schema. Implementar antes é retrabalho garantido.

## Fase 0 — Decisão
> 🤖 Modelo: `opus` 🧠

- [ ] **T0.1** Fechar **D1** com os três produtos na mesa: `attributes` livre, tabela satélite do
      host, ou campos por config. Registrar como ADR em `docs/adr/`.
      **Aceite:** ADR escrito, com o que foi descartado e por quê.
- [ ] **T0.2** Fechar **D2** (o `rating` do Sakura) e **D3** (ordem de adoção) na esteira de D1.

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

- [ ] **T2.1** `pgSchema('customer')`, tabela e migrations com journal próprio
      (`customer_migrations`, fora do schema — mesmo raciocínio do `user-module`).
      **Aceite:** migrations **convergentes** (`IF NOT EXISTS`, bloco anônimo em constraint), com o
      teste de forma que o `notification-module@0.1.1` passou a ter.
- [ ] **T2.2** 🧠 Unicidade por tenancy: índice parcial em `(company_id, phone)` no modo multi e em
      `(phone)` no single.
      **Aceite:** teste negativo de isolamento — o mesmo número em duas empresas convive no modo
      multi e colide no single.
- [ ] **T2.3** Cifra de documento por `config.encryptedDocuments`, com chave do host.
      **Aceite:** teste que lê a linha crua do banco e prova que o valor não está lá em claro.
- [ ] **T2.4** Use-cases: `CreateCustomer`, `UpsertByPhone`, `UpdateCustomer`, `SetDocument`,
      `GetCustomer`, `LinkToUser`, `SoftDeleteCustomer`.
      **Aceite:** `UpsertByPhone` resolve em UMA consulta — é o caminho quente do fluxo de conversa.
- [ ] **T2.5** `customer.settings` por empresa, com `GetSettings`/`UpdateSettings` e trilha de
      auditoria na alteração.
      **Aceite:** `name` de documento é imutável — o use-case recusa renomear a chave de um
      documento já existente, e o teste prova; documento cifrado não pode sair do catálogo.
- [ ] **T2.6** `ListCustomers` paginada, com busca por nome e telefone.
      **Aceite:** teste com volume (≥10 mil linhas) medindo que a busca não degrada para varredura.
- [ ] **T2.7** `createCustomerRoutes` (`ModuleRouteTable`), com escopo declarado.
      **Aceite:** o `requiredScopes` de cada rota está no teste — a lição do `user:admin`, que o
      host não tinha como adivinhar.

## Fase 3 — `customers-ui`
> 🤖 Modelo: `sonnet`

- [ ] **T3.1** Listagem: busca, ordenação, filtros com seleção múltipla, limpar filtros e estado na
      URL (`web.md` §7).
      **Aceite:** telefone **mascarado** por padrão; a máscara é prop, não constante.
- [ ] **T3.2** Ficha: Contato, Documentos, Endereços e Últimos pedidos.
      **Aceite:** sem as portas `addressesOf`/`ordersOf`, as seções não são desenhadas — capacidade
      por ausência, com teste.
- [ ] **T3.3** Página de configuração: catálogo de documentos, interruptor de máscara, e a config
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
