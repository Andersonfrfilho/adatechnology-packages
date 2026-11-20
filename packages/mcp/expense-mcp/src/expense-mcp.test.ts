/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import { createExpenseApiClient, ExpenseApiError } from './expense-api.client'
import { parseEnvironment } from './expense-mcp.constant'
import { resolveCategory, toApiMoney } from './server'
import { createTokenProvider } from './token-provider'

const base = { EXPENSE_API_BASE_URL: 'https://api.exemplo.com/v1/', EXPENSE_API_TOKEN: 'tk' }

describe('configuração', () => {
  it('exige token fixo ou OAuth, e nunca mostra o valor no erro', () => {
    expect(() => parseEnvironment({ EXPENSE_API_BASE_URL: 'https://x/v1' })).toThrow(/EXPENSE_API_TOKEN/)
    expect(() => parseEnvironment({ ...base, EXPENSE_OAUTH_PASSWORD: 'segredo-123' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('segredo-123') }),
    )
  })

  it('cabeçalhos extras em JSON e modo só leitura', () => {
    const environment = parseEnvironment({
      ...base,
      EXPENSE_API_HEADERS: '{"x-company-id":"c1"}',
      EXPENSE_MCP_READ_ONLY: 'true',
    })
    expect(environment.EXPENSE_API_HEADERS).toEqual({ 'x-company-id': 'c1' })
    expect(environment.EXPENSE_MCP_READ_ONLY).toBe(true)
    expect(() => parseEnvironment({ ...base, EXPENSE_API_HEADERS: '[1]' })).toThrow(/EXPENSE_API_HEADERS/)
  })
})

describe('entrada do assistente', () => {
  it('valor em pt-BR ou com ponto', () => {
    expect(toApiMoney('R$ 1.500,50')).toBe('1500.50')
    expect(toApiMoney('1500.5')).toBe('1500.50')
    expect(toApiMoney('450')).toBe('450.00')
    expect(() => toApiMoney('0')).toThrow()
  })

  it('categoria por id, nome sem acento ou trecho único', () => {
    const categories = [
      { id: 'a', name: 'Água' },
      { id: 'e', name: 'Energia' },
      { id: 'i', name: 'Internet e telefone' },
    ]
    expect(resolveCategory(categories, 'agua').id).toBe('a')
    expect(resolveCategory(categories, 'internet').id).toBe('i')
    expect(resolveCategory(categories, 'e').id).toBe('e')
    expect(() => resolveCategory(categories, 'aluguel')).toThrow(/não existe/)
  })
})

describe('cliente HTTP', () => {
  it('abre o envelope, manda os cabeçalhos e renova o token num 401', async () => {
    const seen: { url: string; auth: string | undefined; company: string | undefined }[] = []
    let tokenCalls = 0
    const tokens = { invalidate: () => undefined, token: async () => `t${++tokenCalls}` }
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      seen.push({ auth: headers['authorization'], company: headers['x-company-id'], url })
      if (seen.length === 1) return new Response('', { status: 401 })
      return Response.json({ data: [{ id: 'o1' }] })
    }
    const client = createExpenseApiClient({
      environment: parseEnvironment({ ...base, EXPENSE_API_HEADERS: '{"x-company-id":"c1"}' }),
      fetchImpl,
      tokens,
    })
    expect((await client.listOccurrences({ competence: '2026-11', status: 'open' })) as unknown).toEqual([{ id: 'o1' }])
    expect(seen[1]).toEqual({
      auth: 'Bearer t2',
      company: 'c1',
      url: 'https://api.exemplo.com/v1/expense-occurrences?competence=2026-11&status=open',
    })
  })

  it('erro da API vira mensagem com o código', async () => {
    const client = createExpenseApiClient({
      environment: parseEnvironment(base),
      fetchImpl: async () =>
        Response.json({ error: { code: 'EXPENSE_OCCURRENCE_NOT_FOUND', message: 'não achei' } }, { status: 404 }),
      tokens: { invalidate: () => undefined, token: async () => 't' },
    })
    const error = await client.cancelOccurrence('x', { reason: 'r' }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ExpenseApiError)
    expect((error as ExpenseApiError).code).toBe('EXPENSE_OCCURRENCE_NOT_FOUND')
  })
})

describe('token OAuth', () => {
  it('usuário e senha usam o grant password e o token fica em cache', async () => {
    const bodies: string[] = []
    const provider = createTokenProvider(
      parseEnvironment({
        EXPENSE_API_BASE_URL: 'https://x/v1',
        EXPENSE_OAUTH_CLIENT_ID: 'cli',
        EXPENSE_OAUTH_PASSWORD: 'p',
        EXPENSE_OAUTH_TOKEN_URL: 'https://sso/token',
        EXPENSE_OAUTH_USERNAME: 'u',
      }),
      async (_url, init) => {
        bodies.push(String(init?.body))
        return Response.json({ access_token: 'abc', expires_in: 300 })
      },
    )
    expect(await provider.token()).toBe('abc')
    expect(await provider.token()).toBe('abc')
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toContain('grant_type=password')
  })
})
