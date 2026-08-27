/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrada do binário. O transporte é stdio, então **nada além do protocolo pode ir para o stdout** —
 * um `console.log` solto corrompe a sessão MCP. Log de diagnóstico vai para o stderr.
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'

import { SERVER_NAME, parseEnvironment } from './audio-transcription-mcp.constant'
import { createTranscriptionMcpServer } from './server'

async function main(): Promise<void> {
  const environment = parseEnvironment(process.env)
  const server = createTranscriptionMcpServer(environment)

  await server.connect(new StdioServerTransport())
  console.error(`[${SERVER_NAME}] pronto (modelo: ${environment.WHISPER_MODEL_PATH})`)
}

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] falhou ao iniciar:`, error instanceof Error ? error.message : error)
  process.exit(1)
})
