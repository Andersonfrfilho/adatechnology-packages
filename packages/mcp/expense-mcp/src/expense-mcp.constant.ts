/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Configuração do servidor, validada no boot: variável errada falha ao iniciar, nunca na primeira chamada.
 */
import { z } from 'zod'

export const SERVER_NAME = 'expense-mcp'
export const SERVER_VERSION = '0.1.0'

const booleanText = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1')

const headersJson = z
  .string()
  .optional()
  .transform((value, context) => {
    if (value === undefined || value.trim() === '') return {}
    try {
      const parsed: unknown = JSON.parse(value)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
      const entries = Object.entries(parsed as Record<string, unknown>)
      if (!entries.every(([, item]) => typeof item === 'string')) throw new Error('values must be strings')
      return Object.fromEntries(entries) as Record<string, string>
    } catch {
      context.addIssue({ code: 'custom', message: 'EXPENSE_API_HEADERS precisa ser um objeto JSON de strings' })
      return z.NEVER
    }
  })

export const environmentSchema = z
  .object({
    /** Base das rotas, com o prefixo de versão: `https://api.exemplo.com/v1`. */
    EXPENSE_API_BASE_URL: z.url(),
    /** Token fixo (Bearer). Alternativa: o bloco OAuth abaixo. */
    EXPENSE_API_TOKEN: z.string().min(1).optional(),
    EXPENSE_OAUTH_TOKEN_URL: z.url().optional(),
    EXPENSE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    EXPENSE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    EXPENSE_OAUTH_USERNAME: z.string().min(1).optional(),
    EXPENSE_OAUTH_PASSWORD: z.string().min(1).optional(),
    EXPENSE_OAUTH_REFRESH_TOKEN: z.string().min(1).optional(),
    EXPENSE_OAUTH_SCOPE: z.string().min(1).optional(),
    /** Cabeçalhos extras, em JSON (ex.: `{"x-company-id":"..."}`). */
    EXPENSE_API_HEADERS: headersJson,
    /** Fuso do "hoje" (data do pagamento, mês corrente). */
    EXPENSE_TIME_ZONE: z.string().min(1).default('America/Sao_Paulo'),
    /** `true` registra só as ferramentas de leitura. */
    EXPENSE_MCP_READ_ONLY: booleanText,
    EXPENSE_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  })
  .superRefine((value, context) => {
    const oauth = value.EXPENSE_OAUTH_TOKEN_URL !== undefined
    if (value.EXPENSE_API_TOKEN === undefined && !oauth) {
      context.addIssue({
        code: 'custom',
        message: 'Defina EXPENSE_API_TOKEN ou EXPENSE_OAUTH_TOKEN_URL + EXPENSE_OAUTH_CLIENT_ID',
        path: ['EXPENSE_API_TOKEN'],
      })
    }
    if (oauth && value.EXPENSE_OAUTH_CLIENT_ID === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'EXPENSE_OAUTH_CLIENT_ID é obrigatório com OAuth',
        path: ['EXPENSE_OAUTH_CLIENT_ID'],
      })
    }
    if ((value.EXPENSE_OAUTH_USERNAME === undefined) !== (value.EXPENSE_OAUTH_PASSWORD === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'EXPENSE_OAUTH_USERNAME e EXPENSE_OAUTH_PASSWORD vão juntos',
        path: ['EXPENSE_OAUTH_PASSWORD'],
      })
    }
  })

export type ServerEnvironment = z.infer<typeof environmentSchema>

export function parseEnvironment(source: Record<string, string | undefined>): ServerEnvironment {
  const result = environmentSchema.safeParse(source)
  if (!result.success) {
    // Só o nome da variável e o problema, nunca o valor (pode ser segredo).
    const problems = result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    throw new Error(`configuração inválida — ${problems.join('; ')}`)
  }
  return result.data
}
