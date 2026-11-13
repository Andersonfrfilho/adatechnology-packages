/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Autorização da tabela de rotas, cobrada rota por rota e contra as rotas REAIS.
 *
 * O que ele protege: a diferença entre ler e escrever, e a diferença entre escrever cliente e mexer
 * na configuração — onde se desliga a máscara de PII. Um `requiredScopes` esquecido numa rota nova
 * não aparece em nenhum teste de caso de uso: só aqui, e só se a lista for varrida por inteiro.
 */

import { describe, expect, it } from 'bun:test'

import { createCustomerRoutes, CUSTOMER_SCOPE } from './routes'
import { createCustomerModule } from '../CustomerModule'

const module = createCustomerModule({ db: {} as never, config: { tenancy: { mode: 'single' } } })
const routes = createCustomerRoutes({ module })

/** O escopo esperado por rota. Rota nova sem entrada aqui REPROVA — é o ponto do teste. */
const EXPECTED: Record<string, string> = {
  listCustomers: CUSTOMER_SCOPE.READ,
  getCustomer: CUSTOMER_SCOPE.READ,
  getCustomerSettings: CUSTOMER_SCOPE.READ,
  createCustomer: CUSTOMER_SCOPE.WRITE,
  updateCustomer: CUSTOMER_SCOPE.WRITE,
  setCustomerDocument: CUSTOMER_SCOPE.WRITE,
  addCustomerAddress: CUSTOMER_SCOPE.WRITE,
  updateCustomerAddress: CUSTOMER_SCOPE.WRITE,
  removeCustomerAddress: CUSTOMER_SCOPE.WRITE,
  updateCustomerSettings: CUSTOMER_SCOPE.ADMIN,
}

describe('autorização das rotas', () => {
  it('toda rota exige escopo — nenhuma fica aberta por esquecimento', () => {
    const abertas = routes.filter((route) => !route.requiredScopes || route.requiredScopes.length === 0)

    expect(abertas.map((route) => route.operationId)).toEqual([])
  })

  it('nenhuma rota é pública: cadastro de cliente é PII', () => {
    expect(routes.filter((route) => route.scope !== 'user')).toEqual([])
  })

  it('cada rota exige exatamente o escopo declarado', () => {
    const atual = Object.fromEntries(routes.map((route) => [route.operationId, route.requiredScopes?.[0]]))

    expect(atual).toEqual(EXPECTED)
  })

  it('a tabela não tem rota fora da lista esperada, nem falta rota dela', () => {
    expect(routes.map((route) => route.operationId).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it('ler NÃO dá direito de escrever: nenhuma rota de escrita aceita customers:read', () => {
    const escrita = routes.filter((route) => route.method !== 'GET')

    expect(escrita.filter((route) => route.requiredScopes?.includes(CUSTOMER_SCOPE.READ))).toEqual([])
  })

  it('escrever cliente NÃO dá direito de mexer na configuração', () => {
    const configuracao = routes.find((route) => route.operationId === 'updateCustomerSettings')

    expect(configuracao?.requiredScopes).not.toContain(CUSTOMER_SCOPE.WRITE)
  })

  it('produto somente-leitura não publica escrita nenhuma', () => {
    const somenteLeitura = createCustomerRoutes({ module, features: { write: false, settings: false } })

    expect(somenteLeitura.map((route) => route.operationId).sort()).toEqual(['getCustomer', 'listCustomers'])
  })

  it('operationId é único — é a chave do OpenAPI e dos testes de contrato', () => {
    const ids = routes.map((route) => route.operationId)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
