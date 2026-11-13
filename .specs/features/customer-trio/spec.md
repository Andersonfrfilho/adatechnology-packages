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

### 4.1 O que é comum, contado

A tabela abaixo não é impressão: saiu de comparar os nomes de coluna dos três schemas.

| coluna | em quantos produtos |
|---|---|
| `name`, `email`, `phone`, `created_at`, `updated_at` | **3 de 3** |
| `birth_date` | 2 — Sakura e financiamento |
| endereço | 3, em **três formatos**: tabela no Sakura, colunas no financiamento, no pedido no QuickCart |
| `whatsapp_number` separado de `phone` | 2 — Sakura e financiamento (no QuickCart o `phone` JÁ é o do WhatsApp) |
| `document` / `cpf` / `cnpj` | 2, com nomes diferentes → viram `documents` |
| todo o resto | **1 só** |

O núcleo comum ser tão curto é o argumento a favor deste desenho, não contra: campo que existe em um
produto só não vira coluna de pacote — vira `documents` quando é documento, e satélite do host
quando não é (**D1**).

### 4.2 As tabelas

Telefone, documento e endereço são **tabelas**, não jsonb: uma pessoa tem mais de um de cada, e os
três precisam ser pesquisáveis por igualdade — coisa que coluna e B-tree fazem melhor que GIN sobre
jsonb.

Em `attributes` fica só o que é genuinamente livre: o campo customizado, cuja forma a instalação
declara em execução e por isso não pode virar coluna.

```
customers
  id                uuid pk
  company_id        uuid null        -- null em single-tenant; ver tenancy
  name              varchar(255) null
  email             varchar(255) null
  birth_date        date null              -- comum a Sakura e financiamento
  attributes        jsonb not null default '{}'   -- campos customizados (D1)
  external_user_id  uuid null        -- vínculo com o user-module, quando o produto tem login
  deleted_at        timestamptz null -- exclusão lógica, ligada por config
  created_at, updated_at

customer_phones
  id            uuid pk
  customer_id   uuid not null references customers(id) on delete cascade
  number        varchar(20) not null   -- dígitos crus, sem máscara: '5516993056772'
  label         varchar(60) null       -- 'celular', 'casa', 'trabalho'
  is_whatsapp   boolean not null default false
  is_primary    boolean not null default false
  created_at, updated_at

customer_documents
  id            uuid pk
  customer_id   uuid not null references customers(id) on delete cascade
  name          varchar(40) not null   -- 'cpf', 'cnpj' — a chave do catálogo
  value         text not null          -- cifrado quando o catálogo mandar
  fingerprint   varchar(64) null       -- HMAC do valor normalizado; só quando cifrado
  valid         boolean null           -- resultado da última validação, quando houve
  created_at, updated_at

customer_addresses
  id            uuid pk
  customer_id   uuid not null references customers(id) on delete cascade
  label         varchar(60) null       -- 'casa', 'trabalho', 'entrega'
  zip_code      varchar(9) null
  street        varchar(255) null
  number        varchar(20) null
  complement    varchar(120) null
  district      varchar(120) null
  city          varchar(120) null
  state         varchar(2) null
  is_primary    boolean not null default false
  created_at, updated_at
```

### 4.3 A unicidade mora no telefone do WhatsApp, e isso não é detalhe

O número do WhatsApp é como o fluxo de conversa **descobre de quem é a mensagem**. Se dois clientes
pudessem ter o mesmo, a próxima mensagem cairia na ficha errada — e não haveria erro, só resposta
para a pessoa errada.

```sql
CREATE UNIQUE INDEX customer_phones_whatsapp_unique
  ON customer_phones (company_id, number) WHERE is_whatsapp;
```

Parcial: dois clientes podem ter o mesmo telefone fixo de casa; **nenhum** compartilha o número do
WhatsApp. E no banco, não na aplicação — entre a checagem e o `INSERT` cabe outra escrita, e só a
constraint decide (`web.md` §11).

O `company_id` entra no índice porque a unicidade é por empresa no modo multi — o mesmo número pode
ser cliente de dois estabelecimentos do Sakura. Em modo single, `company_id` é nulo e o índice
degenera para o número, que é o comportamento do QuickCart e do financiamento hoje.

**Denormalizar o número em `customers` para "acelerar" está proibido**: seria um cache que diverge
no primeiro update do telefone, e o caminho quente já resolve numa consulta só com este índice.

### 4.4 O caminho quente

`UpsertByPhone` roda a **cada mensagem recebida**. Ele resolve em uma consulta:

```sql
SELECT c.* FROM customers c
  JOIN customer_phones p ON p.customer_id = c.id
 WHERE p.number = $1 AND p.is_whatsapp AND (c.company_id = $2 OR ($2 IS NULL AND c.company_id IS NULL))
```

Sem cliente, cria os dois — cliente e telefone — na mesma transação, com `is_whatsapp` e
`is_primary` verdadeiros.

### 4.5 Endereço de CLIENTE não é endereço de PEDIDO

Esta spec dizia antes que endereço ficaria de fora, porque os três produtos o modelam diferente.
Com a coleção, ele entra — mas a distinção que motivava aquela recusa **continua valendo e é o que
impede a confusão**:

| | o que é | onde vive |
|---|---|---|
| endereço do cliente | cadastro, editável, vários | `customer_addresses` |
| endereço do pedido | **retrato** de para onde aquela entrega foi | tabela do pedido, no host |

O QuickCart guarda o endereço no pedido de propósito — a entrega é do pedido, e mudar o cadastro do
cliente **não pode** reescrever para onde uma entrega passada foi. A adoção copia os endereços para
o cadastro, e o pedido segue com o retrato dele.

### 4.5b Documento único, quando o produto quiser

Com documento em tabela, "um CPF pertence a um cliente só" deixa de ser regra na aplicação e vira
constraint. É opcional, porque nem todo produto quer: um mercado pode ter dois cadastros do mesmo
CPF por engano e preferir tratar depois; o financiamento não pode.

```ts
readonly uniqueDocuments?: readonly string[]   // ['cpf'] — em config de BOOT
```

Gera índice único parcial por `name`, sobre `fingerprint` quando cifrado e sobre `value` quando não.
É de boot e não da tela: ligar depois, com duplicata já gravada, falharia a criação do índice — e a
tela não tem como resolver o conflito por conta própria.

### 4.6 Índices e busca

Cada consulta que o produto faz de verdade, e o índice que a sustenta. Nada aqui é preventivo: o que
não tem consulta correspondente não vira índice.

**Dependência:** o módulo exige `pg_trgm`. A primeira migration faz
`CREATE EXTENSION IF NOT EXISTS pg_trgm` — sem isso, a busca parcial vira varredura sequencial e a
listagem degrada com o catálogo de clientes crescendo.

#### a) Achar quem mandou a mensagem — o caminho quente

```sql
WHERE p.number = $1 AND p.is_whatsapp
```

Servido pelo índice único parcial de §4.3. Igualdade em B-tree, exato. É o mesmo índice que garante
a unicidade — não há um segundo a criar.

#### b) Busca da listagem, por nome ou por qualquer telefone

`ilike '%termo%'` **não usa B-tree**: o curinga à esquerda impede. Com dez mil clientes vira
varredura. Daí GIN com trigram, e não índice comum:

```sql
CREATE INDEX customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX customer_phones_number_trgm ON customer_phones USING gin (number gin_trgm_ops);
```

O telefone mora na tabela filha, então a busca é por existência, e não por junção que multiplica
linhas:

```sql
WHERE c.name ILIKE $1
   OR EXISTS (SELECT 1 FROM customer_phones p WHERE p.customer_id = c.id AND p.number ILIKE $1)
```

**O termo digitado é normalizado para dígitos antes de virar padrão de telefone.** A pessoa digita
`(16) 99305-6772` e o banco guarda `5516993056772`: sem normalizar, a busca não acha nada e parece
defeito de índice quando é de entrada.

#### c) Ordenar por nome

Trigram não ordena. B-tree próprio, e parcial quando há exclusão lógica:

```sql
CREATE INDEX customers_name_sort ON customers (company_id, name) WHERE deleted_at IS NULL;
```

`WHERE deleted_at IS NULL` mantém o índice do tamanho do que a tela realmente lista.

#### d) Filtrar por campo customizado

Dois casos, e confundi-los é o que faz jsonb ter má fama:

| consulta | índice |
|---|---|
| igualdade / contém (`estado civil = casado`) | `CREATE INDEX ... USING gin (attributes jsonb_path_ops)` — um só, serve a todas as chaves |
| faixa ou ordenação (`renda > 5000`) | índice de EXPRESSÃO, por chave: `CREATE INDEX ... ON customers (((attributes->>'renda_mensal')::numeric))` |

O GIN entra com o módulo. O de expressão é **pontual, criado pelo host quando medir a necessidade** —
um por campo que realmente se filtra por faixa. Criar um para cada campo declarado seria pagar
escrita por consulta que ninguém faz.

#### e) ⚠️ Buscar por documento CIFRADO — o caso que não fecha sozinho

Aqui está a armadilha. Documento cifrado **não é pesquisável** por índice nenhum: dois CPFs iguais
geram textos cifrados diferentes se a cifra tiver nonce, e o índice não tem o que comparar. "Achar o
cliente pelo CPF" simplesmente não funcionaria no financiamento.

A saída é um **índice cego**: ao lado do valor cifrado, o HMAC-SHA256 do valor normalizado, com
chave do host. Com documento em tabela, ele é um B-tree comum — não precisa de GIN nem de jsonb:

```sql
CREATE INDEX customer_documents_fingerprint
  ON customer_documents (name, fingerprint) WHERE fingerprint IS NOT NULL;
```

```sql
-- "quem é o dono deste CPF?"
WHERE d.name = 'cpf' AND d.fingerprint = $1
```

O que isso dá e o que custa, dito de frente:

- **dá** busca por igualdade exata — que é como se busca CPF, sempre
- **não dá** busca parcial nem faixa; e não deveria dar, num dado desses
- **vaza** que dois clientes têm o mesmo documento, porque o HMAC é igual. É consequência
  inevitável de qualquer busca por igualdade sobre dado cifrado, e é aceitável: documento repetido
  entre dois cadastros é justamente o que se quer descobrir
- a chave do HMAC é **a mesma classe de segredo** da chave de cifra: fora do banco, e girada junto

Documento **não cifrado** dispensa a impressão: busca-se pelo próprio valor, com índice em
`(name, value)`.

Sem o índice cego, a única alternativa seria decifrar a base inteira a cada busca — inviável e pior
para a segurança.

### 4.7 Como fica dinâmico E rápido

A tensão é real: campo é declarado em execução, índice é DDL. Não se cria B-tree para uma coluna que
ainda não existe. A saída é reconhecer que **as consultas não são todas iguais** e cobrar DDL só da
minoria que precisa.

#### Camada 1 — o que já é rápido sem nada declarado

Um GIN `jsonb_path_ops` sobre `attributes` inteiro serve **igualdade e contenção em qualquer chave,
inclusive nas que ainda não existem**:

```sql
CREATE INDEX customers_attributes_gin ON customers USING gin (attributes jsonb_path_ops);
```

```sql
WHERE attributes @> '{"estado_civil": "casado"}'     -- usa o índice
WHERE attributes @> '{"rating": 5}'                  -- usa o mesmo índice
```

Um índice, todas as chaves, zero DDL por campo. **É aqui que a maioria das consultas de campo
customizado cai** — filtro é quase sempre igualdade: estado civil, tipo de pessoa, origem do lead.

#### Camada 2 — busca textual, também sem DDL por campo

Nome e telefone já têm GIN trigram (§4.6). Para o texto dos campos customizados, uma coluna
`search_vector tsvector` mantida por trigger, concentrando o que é pesquisável em um lugar só:

```sql
CREATE INDEX customers_search ON customers USING gin (search_vector);
```

Continua sendo um índice para N campos. Quem entra no vetor é decidido pelo catálogo (`searchable:
true`), sem migration.

#### Camada 3 — faixa e ordenação, o único caso que exige DDL

`renda > 5000` e `ordenar por renda` não saem de GIN. Aí é índice de expressão, por chave:

```sql
CREATE INDEX CONCURRENTLY customers_attr_renda_mensal
  ON customers (((attributes->>'renda_mensal')::numeric));
```

**E é a própria página de configuração que o cria.** Marcar um campo como `filterable` no catálogo
enfileira a criação do índice; desmarcar enfileira a remoção. O operador declara a intenção, o módulo
resolve o DDL.

Cinco regras que isso obriga, e nenhuma é opcional:

1. **`CREATE INDEX CONCURRENTLY`, fora de transação e fora da requisição.** Concorrente para não
   travar escrita numa tabela que o fluxo de conversa escreve a cada mensagem; em job, porque em
   tabela grande leva minutos e nenhum HTTP espera isso. A tela mostra "criando" até terminar.

2. **⚠️ `name` vai para dentro de DDL — é injeção de SQL esperando acontecer.** O nome do campo vem
   de um formulário. Validação estrita no contrato, `^[a-z][a-z0-9_]{0,40}$`, e identificador citado
   na montagem. Sem isso, a página de configuração é um console de SQL com outro nome.

3. **O cast segue o `type` declarado** — `::numeric`, `::date`, texto por padrão. Cast errado faz o
   índice existir e o planejador ignorá-lo, que é o pior dos mundos: custo de escrita sem ganho de
   leitura.

4. **Teto de campos filtráveis, e ele é baixo.** Proposta: **8**. Todo índice cobra INSERT e UPDATE,
   e `UpsertByPhone` escreve **a cada mensagem recebida** — vinte índices em `customers` fariam a
   conversa pagar por relatórios que ninguém abre. A tela recusa o nono e diz por quê.

5. **Trocar o `type` de campo já filtrável** derruba e recria o índice, na mesma fila.

#### Onde cada consulta cai

| consulta | camada | custo de declaração |
|---|---|---|
| quem mandou a mensagem | índice único parcial (§4.3) | nenhum |
| nome ou telefone, parcial | GIN trigram | nenhum |
| campo customizado = valor | GIN `jsonb_path_ops` | nenhum |
| texto em campo customizado | `search_vector` | marcar `searchable` |
| faixa ou ordenação por campo | índice de expressão | marcar `filterable`, e conta no teto de 8 |

Três das cinco linhas não custam nada, e são as que a operação usa todo dia. A quinta é a única com
DDL, é a mais rara, e agora tem dono: quem quer o relatório assume o custo de escrita, explicitamente,
numa tela.

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
  document_catalog    jsonb not null default '[]'   -- CPF, CNPJ, RG…
  field_catalog       jsonb not null default '[]'   -- renda, estado civil, rating… (D1)
  updated_at, updated_by_user_id
```

Dois catálogos e não um: documento tem validador, máscara e a semântica de "identifica a pessoa";
campo customizado tem tipo e opções. Unificá-los pareceria elegante e obrigaria metade das
propriedades a ficar sem uso na outra metade.

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
- o catálogo de campos customizados: nome, rótulo, tipo, opções, obrigatoriedade, e os dois
  interruptores de busca — `searchable` (grátis) e `filterable` (cria índice, teto de 8)
- o interruptor de máscara de telefone na listagem
- **somente leitura**, e claramente marcado como tal: o que vem do boot (tenancy, quais documentos
  são cifrados, exclusão lógica). Mostrar sem deixar editar é melhor que esconder — quem configura
  precisa saber o que está em vigor, e por que não pode mexer dali.

Três regras que a tela precisa respeitar:

1. **`name` é imutável depois de criado**, nos dois catálogos. Ele é a chave dentro do `documents`
   e do `attributes` de cada cliente; renomear órfãna o histórico de todo mundo. O rótulo muda; a
   chave, não.
2. **Nada cifrado sai do catálogo pela tela.** Sumiria a definição de um dado que continua no banco,
   cifrado, sem ninguém sabendo o que é.
3. **Trocar `type` de um campo já usado é recusado.** Já existe valor gravado na forma antiga, e
   converter em massa é migration, não clique.
4. **Toda alteração vai para a trilha de auditoria** com ator, alvo e timestamp (`security.md` §10) —
   mexer em obrigatoriedade de documento e em máscara de PII é ação sensível.

## 6. Use-cases

`CreateCustomer`, `UpsertByPhone`, `UpdateCustomer`, `SetDocument`, `ListCustomers` (paginada, com
busca por nome e por **qualquer** telefone), `GetCustomer`, `LinkToUser`, `SoftDeleteCustomer`,
`AddPhone`, `RemovePhone`, `SetWhatsAppPhone`, `AddAddress`, `UpdateAddress`, `RemoveAddress`,
`GetSettings`, `UpdateSettings`.

`SetWhatsAppPhone` é separado de `AddPhone` porque marcar um número como o do WhatsApp **desmarca o
anterior**: é a chave de identidade da conversa, e dois marcados ao mesmo tempo é o estado que o
índice parcial recusa. O use-case faz a troca numa transação, em vez de deixar o host coordenar dois
updates e conseguir parar no meio.

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
| QuickCart | `user_id` → `external_user_id`; `phone` → **uma linha** em `customer_phones` com `is_whatsapp`; endereço fica no pedido e o cadastro nasce vazio; 8 clientes hoje em staging |
| Sakura | `establishment_id` → `company_id`; `birth_date` → coluna; `document` → linha em `customer_documents`; `whatsapp_number` e `phone` → **duas linhas**, só a primeira com `is_whatsapp`; tabela `addresses` → `customer_addresses`; `rating` → **D1** |
| Financiamento | CPF/CNPJ cifrados → linhas em `customer_documents`, com impressão para o índice cego; `birth_date` → coluna; `whatsapp_number` e `phone` → duas linhas; `city`/`state` → **uma linha** em `customer_addresses`; renda e estado civil → **D1**; `deleted_at` preservado |

O financiamento é o mais delicado: ele guarda **CPF e renda cifrados** de gente real. A adoção dele
não começa antes de os outros dois estarem em produção sobre o pacote.

## 8. `customers-ui`

Tela composta: listagem com busca, ordenação, filtros e seleção múltipla (`web.md` §7), e ficha com
Contato, Documentos, Endereços e Últimos pedidos.

A **página de configuração** (§5.3) faz parte do pacote e some quando a `CustomerApi` não traz
`updateSettings` — capacidade por ausência, como no `user-ui`.

Telefones, endereços e documentos **são do pacote** e a ficha os edita: acrescentar, remover,
escolher o principal e marcar qual número é o do WhatsApp.

**Pedidos não são** — chegam por porta opcional `ordersOf`. Sem ela, a seção não é desenhada.

A tela do Sakura (903 linhas) é a referência de conteúdo, e a migração dela é o primeiro teste real
de que o pacote serve.

## 9. Decisões abertas

**✅ D1 — RESOLVIDA: campo customizado em `attributes`, com catálogo declarado.**

Renda mensal, estado civil, faturamento e co-participante não cabem em `documents`. A saída é a
mesma que já funcionou para documento: **jsonb com catálogo**, não jsonb solto.

A distinção é tudo. `attributes` livre seria depósito sem forma — ninguém sabe o que existe, nada
valida, e dado cifrado lá dentro é impossível de auditar. Com catálogo, a instalação **declara** os
campos, e o pacote passa a saber o que cada chave é:

```ts
type FieldDefinition = {
  readonly name: string           // 'renda_mensal' — chave estável, imutável; ^[a-z][a-z0-9_]{0,40}$
  readonly label: string          // 'Renda mensal'
  readonly type: 'text' | 'number' | 'date' | 'money' | 'boolean' | 'select'
  readonly options?: readonly { value: string; label: string }[]   // para `select`
  readonly required: boolean
  readonly encrypted?: boolean    // cifrado em repouso, pela chave do host
  /** Entra no `search_vector`. Sem DDL. */
  readonly searchable?: boolean
  /** Ganha índice de expressão para faixa e ordenação. Custa DDL e escrita; teto de 8 (§4.7). */
  readonly filterable?: boolean
}
```

Com isso o pacote **valida** (tipo, obrigatoriedade, opção fora da lista), **cifra o que foi
declarado cifrado** e a `customers-ui` **desenha o formulário sozinha** — o financiamento acrescenta
"estado civil" numa tela de configuração, sem migration e sem deploy.

Duas saídas descartadas, e por quê:

- **Tabela satélite do host** (era a minha recomendação) resolveria a tipagem, mas devolve a cada
  produto a obrigação de escrever repositório, migration e formulário próprios — o pacote entregaria
  metade do problema. E não serve ao produto que só quer um campo a mais.
- **Colunas geradas por config** dariam tipagem e índice de graça, ao custo de migration no pacote a
  cada campo novo de cada produto — exatamente o que a §2 existe para evitar.

**O custo que isto tem, e vale saber antes:** filtrar e ordenar por campo em jsonb é mais caro que
por coluna. Para exibir e editar, é indiferente. O detalhamento dos índices — incluindo o índice
cego que torna documento cifrado pesquisável — está em §4.6.

**✅ D2 — RESOLVIDA:** o `rating` do Sakura é campo customizado do tipo `number`. Cai em `attributes`
pela mesma regra.

**D3 — a ordem de adoção.** Proposta: QuickCart (não tem tela, é o menor risco) → Sakura (valida a
tela e o multiempresa) → financiamento (PII cifrada, só depois dos dois).

## 10. Critérios de aceite

- [ ] `customer-module` com schema, migrations de journal próprio e as migrations **convergentes**
      (`IF NOT EXISTS`, bloco anônimo em constraint) — a lição do `notification-module@0.1.1`
- [ ] Unicidade correta nos dois modos de tenancy, com teste negativo de isolamento
- [ ] Documento cifrado só entra e sai pela chave do host; teste que prova que o valor cru não é
      persistido
- [ ] Índice único parcial garante **um** cliente por número de WhatsApp, por empresa; teste de
      concorrência prova que duas escritas simultâneas do mesmo número criam um cliente só
- [ ] `SetWhatsAppPhone` desmarca o anterior na mesma transação
- [ ] `UpsertByPhone` resolve em UMA consulta mesmo com telefone em tabela filha
- [ ] `ListCustomers` busca por **qualquer** telefone do cliente, não só o do WhatsApp
- [ ] A busca por telefone normaliza o termo para dígitos antes de consultar — teste com
      `(16) 99305-6772` achando `5516993056772`
- [ ] Índice GIN trigram em nome e número; teste com ≥10 mil clientes provando que a busca não vira
      varredura sequencial (`EXPLAIN` no teste, não cronômetro)
- [ ] Documento cifrado é encontrável por igualdade via índice cego (B-tree em
      `(name, fingerprint)`), e o valor cru não aparece em lugar nenhum — nem na coluna, nem no
      índice
- [ ] `uniqueDocuments` gera índice único parcial e recusa o segundo cliente com o mesmo CPF
- [ ] Marcar um campo como `filterable` cria índice de expressão em job, `CONCURRENTLY`, e a tela
      mostra o estado até concluir; desmarcar remove
- [ ] `name` fora de `^[a-z][a-z0-9_]{0,40}$` é recusado no contrato — teste com `renda"; DROP`
- [ ] O nono campo `filterable` é recusado, com a razão dita ao operador
- [ ] A ficha edita telefones, endereços e documentos; sem a porta `ordersOf`, a seção de pedidos
      não é desenhada
- [ ] Migração de expansão do QuickCart **preserva os clientes existentes** — teste que conta as
      linhas antes e depois, e que todo cliente sai com exatamente um telefone de WhatsApp
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
