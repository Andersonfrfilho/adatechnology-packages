# Spec — Trio plugável `customer`

> 🤖 Modelo por fase na seção 11.

Três produtos do ecossistema guardam a mesma pessoa com três nomes e três formatos. Esta spec
descreve o trio `customer-contracts` / `customer-module` / `customers-ui`, o caminho de adoção e —
sobretudo — como os produtos que **já têm cliente** adotam o pacote **sem perder nada do que existe**.

## 1. O que existe hoje, medido

Não é suposição: os três schemas foram lidos lado a lado antes desta spec.

| | QuickCart `customers` | Sakura `customers` | Financiamento `financing_clients` |
|---|---|---|---|
| chave | `phone` única | `whatsapp_number` por estabelecimento | `whatsapp_number` única |
| multiempresa | não | **sim** (`establishment_id`) | não |
| nome | opcional | **obrigatório** | opcional |
| campos próprios | — | documento, nascimento, `rating` | 12+: CPF, renda, estado civil, co-participante, CNPJ, faturamento |
| PII cifrada | não | não | **sim** (`*_encrypted`) |
| exclusão lógica | não | não | **sim** (`deleted_at`) |
| vínculo com login | **sim** (`user_id`) | não | não |
| tela | **não existe** | 903 linhas, com Contato, Detalhes, Endereços e Últimos pedidos | não |
| busca no repositório | não existe | `listByEstablishment` com `ilike` em nome e número | — |

Duas leituras saem daí:

1. **O núcleo comum é pequeno** — id, número de WhatsApp, nome, e-mail, timestamps.
2. **A divergência é onde está o valor de cada produto**, e é ela que decide se o pacote vive ou vira
   camisa de força.

## 2. A decisão que destrava: documento é DADO, não coluna

CPF, CNPJ, RG e documento genérico do Sakura não viram colunas do pacote. Viram uma lista:

```ts
type CustomerDocument = {
  readonly name: string        // 'cpf', 'cnpj', 'rg' — a chave que o produto conhece
  readonly label: string       // 'CPF' — o que a pessoa lê na tela
  readonly value: string       // o valor, cifrado em repouso quando a política do host mandar
  readonly valid?: boolean     // resultado da última validação, quando houve
  readonly required?: boolean  // se o produto exige para seguir
}
```

É isto que torna o pacote possível. Sem essa forma, o `customer-module` precisaria de uma coluna por
documento de cada produto, e cada produto novo faria migration no pacote — o oposto de plugável.

**O que a lista NÃO resolve, e a spec não finge que resolve:** renda mensal, estado civil, cidade,
faturamento e co-participante do financiamento não são documentos. Ver a decisão aberta **D1**.

## 3. Anatomia

| pacote | papel |
|---|---|
| `@adatechnology/customer-contracts` | tipos, schemas Zod, portas e erros. Sem I/O. |
| `@adatechnology/customer-module` | `pgSchema('customer')`, migrations com journal próprio, repositórios, use-cases e tabela de rotas |
| `@adatechnology/customers-ui` | tela composta de listagem e ficha, no molde do `conversations-ui` |

Mesmo idioma do `user-module`: journal separado, capacidade por ausência, host injeta as portas que
só ele pode responder.

## 4. Modelo de dados — `pgSchema('customer')`

```
customers
  id                uuid pk
  company_id        uuid null        -- null em single-tenant; ver tenancy
  phone             varchar(20) not null   -- número de WhatsApp, dígitos crus
  name              varchar(255) null
  email             varchar(255) null
  secondary_phone   varchar(20) null       -- o Sakura e o financiamento separam os dois
  documents         jsonb not null default '[]'
  attributes        jsonb not null default '{}'   -- ver D1
  external_user_id  uuid null        -- vínculo com o user-module, quando o produto tem login
  deleted_at        timestamptz null -- exclusão lógica, ligada por config
  created_at, updated_at
```

**A unicidade é configurável, e isso não é luxo:** o Sakura permite o mesmo número em
estabelecimentos diferentes; QuickCart e financiamento não. Índice único parcial sobre
`(company_id, phone)` em modo multi e sobre `(phone)` em modo single — a mesma decisão que o
`user-module` já toma em `resolveScopeCompanyId`.

**Documento cifrado em repouso** quando `config.encryptedDocuments` listar o `name`. A chave é do
host, separada da chave do banco (`security.md` §5). O financiamento hoje cifra CPF e renda; sem
isso o pacote seria um retrocesso de segurança para ele.

## 5. Duas configurações, e elas NÃO são a mesma coisa

Misturá-las é o erro clássico deste tipo de módulo: ou tudo vira env e o operador depende de deploy
para mudar um rótulo, ou tudo vira tela e alguém desliga a cifra de CPF por engano num sábado.

### 5.1 Configuração de BOOT — código, imutável em execução

```ts
type CustomerModuleConfig = {
  readonly tenancy: { mode: 'single' } | { mode: 'multi' }
  /** Documentos cifrados em repouso, por `name`. A chave é do host. */
  readonly encryptedDocuments?: readonly string[]
  /** Exclusão lógica. Ausente = remoção física. */
  readonly softDelete?: boolean
}
```

São **estruturais**: mudam índice, forma de armazenamento e o que é recuperável. Trocar
`encryptedDocuments` em execução deixaria linhas cifradas e linhas em claro na mesma coluna, sem
nada dizendo qual é qual. Não vão para tela nenhuma.

### 5.2 Ajustes de OPERAÇÃO — dado, editáveis na tela

Vivem em `customer.settings`, por empresa, e mudam sem deploy:

```
customer.settings
  company_id        uuid null pk
  mask_phone_in_list  boolean not null default true
  document_catalog    jsonb not null default '[]'
  updated_at, updated_by_user_id
```

`document_catalog` é o que a instalação declara existir:

```ts
type DocumentDefinition = {
  readonly name: string        // 'cpf' — a chave, estável; renomear quebra o histórico
  readonly label: string       // 'CPF' — o que a pessoa lê; muda à vontade
  readonly required: boolean   // se a ficha exige para salvar
  readonly mask?: string       // '###.###.###-##', quando houver
  readonly validator?: 'cpf' | 'cnpj' | 'none'
}
```

É isto que faz o mesmo pacote servir a um mercado que só quer nome e telefone e a um financiamento
que exige CPF válido: **o catálogo é dado, não código**.

`mask_phone_in_list` na tela pelo mesmo motivo — a exposição aceitável muda com o balcão, e um
produto não deveria precisar de deploy para proteger o telefone do cliente. Padrão `true`: telefone
é PII, e o padrão protege.

### 5.3 A página de configuração

Tela em `customers-ui`, **escopo `admin` apenas**, com:

- o catálogo de documentos: acrescentar, renomear rótulo, marcar obrigatório, escolher validador
- o interruptor de máscara de telefone na listagem
- **somente leitura**, e claramente marcado como tal: o que vem do boot (tenancy, quais documentos
  são cifrados, exclusão lógica). Mostrar sem deixar editar é melhor que esconder — quem configura
  precisa saber o que está em vigor, e por que não pode mexer dali.

Três regras que a tela precisa respeitar:

1. **`name` de documento é imutável depois de criado.** Ele é a chave no `documents` de cada
   cliente; renomear órfãna o histórico de todo mundo. O rótulo muda; a chave, não.
2. **Documento cifrado não pode ser removido do catálogo pela tela.** Sumiria a definição de um dado
   que continua no banco, cifrado, sem ninguém sabendo o que é.
3. **Toda alteração vai para a trilha de auditoria** com ator, alvo e timestamp (`security.md` §10) —
   mexer em obrigatoriedade de documento e em máscara de PII é ação sensível.

## 6. Use-cases

`CreateCustomer`, `UpsertByPhone`, `UpdateCustomer`, `SetDocument`, `ListCustomers` (paginada, com
busca por nome e telefone), `GetCustomer`, `LinkToUser`, `SoftDeleteCustomer`, `GetSettings`,
`UpdateSettings`.

`UpsertByPhone` é o que o fluxo de conversa chama a cada mensagem — é o caminho quente e precisa ser
uma consulta só.

## 7. Adoção sem perder o que existe

**Requisito inegociável:** nenhum produto perde dado na adoção. Expansão e contração, nunca troca
seca (`database.md`).

Por produto:

1. **Migration de expansão** cria `customer.customers` e **copia** as linhas da tabela do host,
   mapeando os campos próprios para `documents`/`attributes`. Nada é apagado.
2. O host passa a **ler e escrever pelo pacote**, mantendo a tabela antiga intacta.
3. Só depois de o produto rodar em produção sobre o pacote, uma migration de contração remove a
   tabela antiga — com plano de rollback escrito.

| produto | o que a cópia precisa preservar |
|---|---|
| QuickCart | `user_id` → `external_user_id`; 8 clientes hoje em staging |
| Sakura | `establishment_id` → `company_id`; `document`, `birth_date` → `documents`; `rating` → `attributes` |
| Financiamento | CPF/CNPJ cifrados → `documents` cifrados; renda, estado civil, cidade → ver **D1**; `deleted_at` preservado |

O financiamento é o mais delicado: ele guarda **CPF e renda cifrados** de gente real. A adoção dele
não começa antes de os outros dois estarem em produção sobre o pacote.

## 8. `customers-ui`

Tela composta: listagem com busca, ordenação, filtros e seleção múltipla (`web.md` §7), e ficha com
Contato, Documentos, Endereços e Últimos pedidos.

A **página de configuração** (§5.3) faz parte do pacote e some quando a `CustomerApi` não traz
`updateSettings` — capacidade por ausência, como no `user-ui`.

Endereços e pedidos **não são do pacote** — chegam por porta opcional (`addressesOf`, `ordersOf`).
Capacidade por ausência: sem a porta, a seção não é desenhada. O Sakura tem as duas; o QuickCart tem
pedidos e não tem endereço próprio de cliente.

A tela do Sakura (903 linhas) é a referência de conteúdo, e a migração dela é o primeiro teste real
de que o pacote serve.

## 9. Decisões abertas

**D1 — o que fazer com campo de domínio que não é documento.** Renda mensal, estado civil, cidade,
faturamento e co-participante do financiamento não cabem em `documents`. Três saídas:

- **(a) `attributes` jsonb livre** no pacote. Simples, mas vira depósito sem forma, e dado cifrado
  dentro de jsonb livre é difícil de auditar.
- **(b) Tabela satélite do host** (`financing_client_profile`) com FK para `customer.customers`. O
  pacote fica limpo, o produto guarda o que é dele. **Recomendada.**
- **(c) Campos declarados por config**, com o pacote gerando colunas. Poderoso e caro; é migration no
  pacote a cada produto novo, exatamente o que a seção 2 evita.

**D2 — o `rating` do Sakura** é `attributes` ou satélite? Cai junto com D1.

**D3 — a ordem de adoção.** Proposta: QuickCart (não tem tela, é o menor risco) → Sakura (valida a
tela e o multiempresa) → financiamento (PII cifrada, só depois dos dois).

## 10. Critérios de aceite

- [ ] `customer-module` com schema, migrations de journal próprio e as migrations **convergentes**
      (`IF NOT EXISTS`, bloco anônimo em constraint) — a lição do `notification-module@0.1.1`
- [ ] Unicidade correta nos dois modos de tenancy, com teste negativo de isolamento
- [ ] Documento cifrado só entra e sai pela chave do host; teste que prova que o valor cru não é
      persistido
- [ ] `ListCustomers` com busca por nome e telefone, paginada, e teste com volume
- [ ] `customers-ui` desenha a ficha sem endereço e sem pedido quando as portas faltam
- [ ] Migração de expansão do QuickCart **preserva os clientes existentes** — teste que conta as
      linhas antes e depois
- [ ] Telefone mascarado na listagem por padrão, inteiro na ficha
- [ ] Página de configuração: `name` de documento imutável, documento cifrado não removível pela
      tela, e config de boot exibida como somente leitura
- [ ] Alteração de configuração grava trilha de auditoria com ator e timestamp
- [ ] Nenhum telefone, documento ou renda em log, em nenhum nível

## 11. Modelos por etapa (`model-economy.md`)

| etapa | modelo |
|---|---|
| Desenhar schema, tenancy e a forma de `documents` | `opus` 🧠 |
| Fechar D1 com os três produtos na mesa | `opus` 🧠 |
| Implementar contracts, module e use-cases | `sonnet` |
| Migrations de expansão por produto | `sonnet` (🧠 no financiamento, por causa da PII cifrada) |
| `customers-ui` a partir da tela do Sakura | `sonnet` |
| Passe de rótulo, i18n e ícone | `haiku` |
