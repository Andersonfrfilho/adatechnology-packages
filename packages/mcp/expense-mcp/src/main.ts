/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrada do binário. O transporte é stdio: **nada além do protocolo vai para o stdout**. Log vai para o stderr,
 * e nunca com token ou senha.
 */
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'

import { SERVER_NAME, parseEnvironment } from './expense-mcp.constant'
import { createExpenseMcpServer } from './server'

async function main(): Promise<void> {
  const environment = parseEnvironment(process.env)
  const server = createExpenseMcpServer(environment)
  await server.connect(new StdioServerTransport())
  console.error(
    `[${SERVER_NAME}] pronto (${new URL(environment.EXPENSE_API_BASE_URL).host}${environment.EXPENSE_MCP_READ_ONLY ? ', só leitura' : ''})`,
  )
}

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] falhou ao iniciar:`, error instanceof Error ? error.message : error)
  process.exit(1)
})
