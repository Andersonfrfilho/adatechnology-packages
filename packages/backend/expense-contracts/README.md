# @adatechnology/expense-contracts

Regras puras de **contas a pagar**, sem I/O e sem dependência de runtime. Servem a qualquer produto: restaurante,
transportadora, escritório. Quem tem banco usa o [`@adatechnology/expense-module`](../expense-module); quem já tem o
próprio banco usa só estas regras.

```bash
npm install @adatechnology/expense-contracts
```

## Convenções

- **Dinheiro é texto com duas casas** (`"1500.50"`), e toda conta é feita em centavos (`bigint`). Nunca `number`.
- **Datas civis** são `yyyy-mm-dd`; **competência** (o mês da conta) é `yyyy-mm`.
- Vocabulário: **conta** (`Expense`, fixa ou variável), **vencimento** (`ExpenseOccurrence`, o que vence e é pago),
  **categoria**, **mudança de valor** (reajuste ou correção, com histórico).

## O que tem

| Arquivo | Para quê |
|---|---|
| `money` | `parseMoneyToCents`, `formatCents`, `normalizeMoney`, `formatBrl`, `divideHalfUp`, `distributeByWeight`, datas civis e fuso (`civilDateInTimeZone`) |
| `schedule` | vencimento por competência (`resolveExpenseDueDate`, dia 31 cai no último dia), recorrência mensal/bimestral/trimestral/anual/quinzenal, parcelas e a janela de geração (`planFixedExpenseOccurrences`) |
| `amount` | valor em vigor numa competência (`amountInEffect`) e o plano de reajuste/correção (`planAmountChange`) |
| `summary` | resumo do período: previsto, pago, em aberto, vencido e por categoria (`summarizeExpenseOccurrences`) |
| `occurrenceTransition` | o que cada estado permite (`open` → pagar/cancelar; `paid` → reabrir) |
| `reminder` | quando avisar (antes, no dia, em atraso), quem recebe (responsável, senão administradores) e por qual canal |
| `reminderText` | valores e textos do aviso (e-mail e WhatsApp), com o nome da empresa na variável que o produto escolher |
| `whatsappInput` | entrada digitada: valor (`R$ 1.500,50`), data (`20/11`, `amanhã`), dia do mês, "paguei 150" |
| `conversation` | máquina de estados pura para **lançar conta pela conversa** (WhatsApp, chat): tipo → nome → categoria → valor → vencimento → confirmar |
| `allocation` | rateio das contas entre unidades de trabalho (viagem, pedido, atendimento) por distância, dias, receita ou igual |
| `forecast` | previsão do mês seguinte e o que saiu do padrão |
| `errors` | códigos estáveis (`EXPENSE_*`) com status HTTP e texto pt-BR |

## Exemplos

```ts
import { planFixedExpenseOccurrences, summarizeExpenseOccurrences, formatBrl } from '@adatechnology/expense-contracts'

planFixedExpenseOccurrences({ anchorCompetence: '2026-01', dueDay: 31, recurrence: 'monthly', today: '2026-01-20' })
// → 31/01, 28/02, 31/03, 30/04

const summary = summarizeExpenseOccurrences(occurrences, '2026-11-20')
formatBrl(summary.overdue) // "R$ 450,00"
```

Lançar conta pela conversa (o produto guarda `state` na sessão e grava quando vier `submit`):

```ts
import { startExpenseConversation, advanceExpenseConversation } from '@adatechnology/expense-contracts'

let turn = startExpenseConversation()           // turn.prompt = "Que tipo de conta…" + opções
turn = advanceExpenseConversation({ categories, input: 'fixa', state: turn.state, today })
// … até turn.state.step === 'done' e turn.submit = { kind, name, categoryId, expectedAmount, recurrence, dueDay }
```

## Testes

```bash
pnpm --filter @adatechnology/expense-contracts test
```
