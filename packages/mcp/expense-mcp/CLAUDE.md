# CLAUDE.md — @adatechnology/expense-mcp

Servidor MCP (stdio) de contas a pagar sobre HTTP. Uso e configuração: `README.md`.

- **Fala com a API, nunca com o banco.** A empresa vem do token (ou de `EXPENSE_API_HEADERS`, quando a API aceita
  `x-company-id`), e a autorização é da API. Não acrescentar acesso direto ao Postgres.
- **stdout é do protocolo.** Log só no stderr, e nunca com token, senha ou corpo de resposta.
- **Formato comum** às duas APIs (`expense-module` e transportada): caminhos iguais, envelope `{ data }`, lista por
  `competence` + `status` único, baixa com `paidAmount` + `paidAt` (+ `settlementNote`), cancelamento com `reason`.
  Mudar algo aqui exige conferir as duas.
- Ferramenta nova de escrita fica depois do `if (environment.EXPENSE_MCP_READ_ONLY) return server`.
- Valor digitado passa por `toApiMoney` (pt-BR e ponto); resumo usa `summarizeExpenseOccurrences` do contracts.
