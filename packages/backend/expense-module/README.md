# @adatechnology/expense-module

Módulo de **contas a pagar** com estado: categorias, contas fixas e variáveis, vencimentos gerados sozinhos, baixa,
cancelamento, histórico de valor, resumo do período e o que a rotina de avisos precisa. As regras vêm de
[`@adatechnology/expense-contracts`](../expense-contracts) (reexportado por este pacote).

```bash
npm install @adatechnology/expense-module drizzle-orm
```

Funciona com qualquer driver do Drizzle (`node-postgres`, `postgres.js`, `bun-sql`): o host passa o banco e o `migrate`.

## 1. Migrations

As tabelas ficam no schema `expense` e o journal em `drizzle.expense_migrations`: nunca colidem com as do host.

```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { runExpenseMigrations } from '@adatechnology/expense-module'

await runExpenseMigrations({ db, migrate })
```

## 2. Módulo

```ts
import { createExpenseModule } from '@adatechnology/expense-module'

const expenses = createExpenseModule({ db, timeZone: 'America/Sao_Paulo' })

await expenses.expenses.createExpense({
  companyId,                                   // sempre do usuário autenticado, nunca do corpo
  createdBy: userId,
  expense: { kind: 'fixed', name: 'Aluguel', categoryId, expectedAmount: '3500', recurrence: 'monthly', dueDay: 10 },
})
```

| Método | O que faz |
|---|---|
| `listCategories` / `createCategory` / `updateCategory` | categorias; empresa sem nenhuma recebe as padrão na primeira leitura |
| `createExpense` | fixa gera os vencimentos dos próximos 4 meses; variável nasce com um vencimento |
| `updateExpense` | edita; desligar cancela os vencimentos abertos de hoje em diante |
| `changeAmount` / `listAmountHistory` | reajuste (só o que não venceu) ou correção (o trecho inteiro), com histórico |
| `listOccurrences` / `getOccurrence` / `summarize` | vencimentos por período, situação, categoria; resumo do período |
| `settleOccurrence` / `reopenOccurrence` / `cancelOccurrence` | baixa, desfazer baixa, cancelar |
| `generateOccurrences` | **rotina diária**: completa a janela de todas as contas fixas (idempotente) |
| `listReminderCandidates` / `claimReminderDelivery` | **rotina de avisos**: o que avisar hoje e a marca de "já enviado" (duas réplicas nunca mandam duas vezes) |

Todo método recebe `companyId` e filtra por ele: registro de outra empresa responde como inexistente.

## 3. Rotas HTTP

Rotas declaradas como dado (`@adatechnology/module-http`): o host monta com o adaptador `fetch` (Bun.serve, Hono…)
ou com o próprio roteador (`dispatchRoute`).

```ts
import { createExpenseRoutes } from '@adatechnology/expense-module'
import { createModuleFetchRouter } from '@adatechnology/expense-module/http/fetch'

const router = createModuleFetchRouter({
  basePath: '/v1',
  routes: createExpenseRoutes({ module: expenses }),
  authResolver: { resolve: async ({ headers }) => /* { companyId, userId, scopes } */ },
})
```

Escopos: `expenses:read` (ler) e `expenses:write` (lançar, pagar, cancelar). Respostas em `{ data }`; erro em
`{ error: { code, message } }` com os códigos `EXPENSE_*`.

| Método | Caminho | Corpo / query |
|---|---|---|
| GET | `/expense-categories` | `includeInactive` |
| POST | `/expense-categories` | `{ name, costGroup?, displayOrder? }` |
| PATCH | `/expense-categories/:id` | `{ name?, costGroup?, displayOrder?, active? }` |
| GET | `/expenses` | `active`, `kind`, `categoryId`, `search` |
| POST | `/expenses` | `{ kind, name, categoryId, expectedAmount, recurrence?, dueDay?, dueDate?, installmentsTotal?, supplier?, payeeName?, payeeRef?, assetRef?, responsibleUserId?, billUrl?, notes? }` |
| GET / PATCH | `/expenses/:id` | edição sem valor (valor é por `amount-changes`) |
| GET | `/expenses/:id/amount-history` | |
| POST | `/expenses/:id/amount-changes` | `{ newAmount, kind?, effectiveFrom?, correctionCompetence? }` |
| GET | `/expense-occurrences` | `competence` (yyyy-mm) ou `from`/`to`, `status` (lista com vírgula), `kind`, `categoryId`, `expenseId`, `search`, `limit` |
| GET | `/expense-occurrences/:id` | |
| GET | `/expense-summary` | mesmos filtros da lista |
| POST | `/expense-occurrences/:id/settlement` | `{ paidAmount?, paidAt?, settlementNote?, via? }` |
| DELETE | `/expense-occurrences/:id/settlement` | desfaz a baixa |
| POST | `/expense-occurrences/:id/cancellation` | `{ reason? }` |

OpenAPI: `expenseOpenApiPaths({ routes })` de `@adatechnology/expense-module/openapi`.

## Assistente (MCP)

[`@adatechnology/expense-mcp`](../../mcp/expense-mcp) conversa com essas rotas: "quanto tenho a pagar este mês?",
"lança o aluguel de 3.500 todo dia 10", "paguei a conta de luz".

## Testes

```bash
pnpm --filter @adatechnology/expense-module test                       # rotas (sem banco)
DATABASE_URL=postgres://… pnpm --filter @adatechnology/expense-module test   # + integração contra Postgres
```
