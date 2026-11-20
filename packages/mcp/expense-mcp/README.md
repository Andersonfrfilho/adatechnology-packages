# @adatechnology/expense-mcp

Servidor MCP de **contas a pagar**. Deixa o Claude (Claude Code, Claude Desktop, ou qualquer cliente MCP) consultar e
lançar contas pela API do seu produto: "quanto tenho a pagar este mês?", "o que está atrasado?", "lança o aluguel de
R$ 3.500 todo dia 10", "paguei a conta de luz".

Ele **fala com a API, nunca com o banco**: autorização, empresa e auditoria continuam sendo da API, e o assistente só
enxerga o que o usuário do token enxerga. Funciona com qualquer API que exponha as rotas do
[`@adatechnology/expense-module`](../../backend/expense-module) (e com a API da transportada, que usa os mesmos
caminhos).

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `list_expense_categories` | categorias e ids |
| `list_expenses` | contas cadastradas (fixas e variáveis) |
| `list_expense_occurrences` | vencimentos de um mês (`competence`), por situação, categoria ou tipo |
| `summarize_expenses` | total, pago, em aberto, vencido e por categoria do mês |
| `create_expense` | lança conta fixa (recorrência + dia) ou variável (data); aceita `R$ 1.500,50` e nome da categoria |
| `settle_expense_occurrence` | dá baixa (valor, data, observação) |
| `cancel_expense_occurrence` | cancela um vencimento, com motivo |

Com `EXPENSE_MCP_READ_ONLY=true` só as quatro primeiras são registradas.

## Configuração

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `EXPENSE_API_BASE_URL` | sim | `https://api.minhaempresa.com/v1` |
| `EXPENSE_API_TOKEN` | um dos dois | token Bearer fixo |
| `EXPENSE_OAUTH_TOKEN_URL` + `EXPENSE_OAUTH_CLIENT_ID` | um dos dois | `https://sso…/realms/x/protocol/openid-connect/token` |
| `EXPENSE_OAUTH_CLIENT_SECRET` | não | client confidencial |
| `EXPENSE_OAUTH_USERNAME` + `EXPENSE_OAUTH_PASSWORD` | não | grant `password` (usuário da empresa) |
| `EXPENSE_OAUTH_REFRESH_TOKEN` | não | grant `refresh_token` (sem usuário e senha, cai em `client_credentials`) |
| `EXPENSE_API_HEADERS` | não | `{"x-company-id":"…"}` |
| `EXPENSE_TIME_ZONE` | não | `America/Sao_Paulo` (padrão) |
| `EXPENSE_MCP_READ_ONLY` | não | `true` |
| `EXPENSE_API_TIMEOUT_MS` | não | `20000` (padrão) |

O token é renovado sozinho antes de vencer (e uma vez num 401). Nada de token ou senha vai para log.

## Adicionar no Claude Code

```bash
claude mcp add expense \
  -e EXPENSE_API_BASE_URL=https://api.minhaempresa.com/v1 \
  -e EXPENSE_OAUTH_TOKEN_URL=https://sso.minhaempresa.com/realms/minha/protocol/openid-connect/token \
  -e EXPENSE_OAUTH_CLIENT_ID=meu-client \
  -e EXPENSE_OAUTH_USERNAME=financeiro@minhaempresa.com \
  -e EXPENSE_OAUTH_PASSWORD='…' \
  -- npx -y @adatechnology/expense-mcp
```

Ou num `.mcp.json` do projeto (sem segredo no arquivo: use `${VAR}` do ambiente):

```json
{
  "mcpServers": {
    "expense": {
      "command": "npx",
      "args": ["-y", "@adatechnology/expense-mcp"],
      "env": {
        "EXPENSE_API_BASE_URL": "https://api.minhaempresa.com/v1",
        "EXPENSE_API_TOKEN": "${EXPENSE_API_TOKEN}"
      }
    }
  }
}
```

Use um usuário com permissão de contas (na transportada, `expenses.manage`; no `expense-module`, os escopos
`expenses:read`/`expenses:write`). Para só consultar, use um usuário de leitura e `EXPENSE_MCP_READ_ONLY=true`.

## Desenvolvimento

```bash
pnpm --filter @adatechnology/expense-mcp test
pnpm --filter @adatechnology/expense-mcp build
EXPENSE_API_BASE_URL=… EXPENSE_API_TOKEN=… bun src/main.ts
```
