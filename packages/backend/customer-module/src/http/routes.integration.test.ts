/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A ficha inteira pela porta HTTP, contra Postgres de verdade. É o único teste que exercita a
 * composição completa — fábrica do módulo, tabela de rotas, despachante, casos de uso e banco.
 *
 * Ele existe porque cada peça já passa sozinha: o que falha na integração é a FIAÇÃO entre elas.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { createHmac, randomUUID } from 'node:crypto'

import type { DocumentCipherPort } from '@adatechnology/customer-contracts'

const DATABASE_URL = process.env['CUSTOMER_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

const cipher: DocumentCipherPort = {
  async encrypt(plaintext) {
    return `enc:${Buffer.from(plaintext).toString('base64')}:${randomUUID().slice(0, 8)}`
  },
  async decrypt(ciphertext) {
    return Buffer.from(ciphertext.split(':')[1] ?? '', 'base64').toString('utf8')
  },
  async fingerprint(plaintext) {
    return createHmac('sha256', 'chave-de-teste').update(plaintext).digest('hex')
  },
}

suite('rotas de cliente ponta a ponta', () => {
  let pool: import('pg').Pool
  let router: { handle(request: Request): Promise<Response> }

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { createModuleFetchRouter } = await import('@adatechnology/module-http/fetch')
    const { createCustomerModule } = await import('../CustomerModule')
    const { createCustomerRoutes, CUSTOMER_SCOPE } = await import('./routes')

    pool = new Pool({ connectionString: DATABASE_URL })
    const module = createCustomerModule({
      db: drizzle({ client: pool }),
      cipher,
      config: { tenancy: { mode: 'single' }, encryptedDocuments: ['cpf'], defaultCountryCode: '55' },
    })

    router = createModuleFetchRouter({
      routes: createCustomerRoutes({ module }),
      basePath: '/v1',
      // O host é quem valida a sessão; o módulo recebe a identidade pronta (`security.md` §2).
      authResolver: {
        async resolve({ headers }: { headers: Record<string, string> }) {
          const scopes = headers['x-test-scopes']
          if (scopes === undefined) return undefined
          return { companyId: 'single', userId: randomUUID(), scopes: scopes ? scopes.split(',') : [] }
        },
      } as never,
    }) as never

    // O catálogo precisa aceitar `cpf` antes de qualquer ficha usá-lo.
    await module.useCases.updateSettings.execute({
      input: {
        maskPhoneInList: true,
        documentCatalog: [{ name: 'cpf', label: 'CPF', required: false, validator: 'none' }],
        fieldCatalog: [],
      } as never,
    })

    void CUSTOMER_SCOPE
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate "customer"."customers" cascade')
  })

  function call(path: string, init: RequestInit & { scopes?: string } = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('content-type', 'application/json')
    if (init.scopes !== undefined) headers.set('x-test-scopes', init.scopes)
    return router.handle(new Request(`http://test/v1${path}`, { ...init, headers }))
  }

  it('cria e lê a ficha inteira, com o CPF decifrado só no detalhe', async () => {
    const created = await call('/customers', {
      method: 'POST',
      scopes: 'customers:write,customers:read',
      body: JSON.stringify({
        name: 'Anderson',
        phones: [{ number: '(16) 99305-6772', isWhatsApp: true }],
        addresses: [{ street: 'Rua A', zipCode: '14020-330', state: 'sp' }],
        documents: [{ name: 'cpf', value: '123.456.789-01' }],
      }),
    })
    expect(created.status).toBe(201)
    const { data } = (await created.json()) as { data: { id: string } }

    const detail = await call(`/customers/${data.id}`, { scopes: 'customers:read' })
    expect(detail.status).toBe(200)
    const ficha = (await detail.json()) as { data: any }

    expect(ficha.data.name).toBe('Anderson')
    // O DDI entrou: sem ele, a próxima mensagem do canal criaria um segundo cliente.
    expect(ficha.data.phones[0].number).toBe('5516993056772')
    expect(ficha.data.phones[0].isWhatsApp).toBe(true)
    expect(ficha.data.addresses[0]).toMatchObject({ zipCode: '14020330', state: 'SP', isPrimary: true })
    expect(ficha.data.documents[0]).toMatchObject({ name: 'cpf', value: '12345678901' })

    // ...e no banco ele continua cifrado.
    const { rows } = await pool.query('select value from "customer"."customer_documents"')
    expect(rows[0].value).not.toContain('12345678901')
  })

  it('a LISTAGEM não devolve documento — decifrar N clientes é chamada de rede por linha', async () => {
    await call('/customers', {
      method: 'POST',
      scopes: 'customers:write',
      body: JSON.stringify({ name: 'Anderson', documents: [{ name: 'cpf', value: '12345678901' }] }),
    })

    const listed = await call('/customers?perPage=10', { scopes: 'customers:read' })
    const body = (await listed.json()) as { data: unknown[] }

    expect(body.data).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('12345678901')
  })

  it('sem sessão é 401; com escopo de leitura tentando escrever é 403', async () => {
    const anonima = await call('/customers', { method: 'POST', body: JSON.stringify({ name: 'X' }) })
    expect(anonima.status).toBe(401)

    const semPermissao = await call('/customers', {
      method: 'POST',
      scopes: 'customers:read',
      body: JSON.stringify({ name: 'X' }),
    })
    expect(semPermissao.status).toBe(403)
  })

  it('número de WhatsApp que já tem dono é 409, com mensagem — não "Erro interno"', async () => {
    const corpo = JSON.stringify({ name: 'Anderson', phones: [{ number: '5516993056772', isWhatsApp: true }] })

    const primeira = await call('/customers', { method: 'POST', scopes: 'customers:write', body: corpo })
    expect(primeira.status).toBe(201)

    const segunda = await call('/customers', { method: 'POST', scopes: 'customers:write', body: corpo })
    expect(segunda.status).toBe(409)

    const { error } = (await segunda.json()) as { error: { code: string; message: string } }
    expect(error.code).toBe('CUSTOMER_WHATSAPP_PHONE_TAKEN')
    expect(error.message).not.toContain('Erro interno')
  })

  it('ficha que não existe é 404, e não 500', async () => {
    const resposta = await call('/customers/00000000-0000-0000-0000-000000000000', { scopes: 'customers:read' })

    expect(resposta.status).toBe(404)
  })

  it('mexer na configuração exige customers:admin — e a autorização vem ANTES da validação do corpo', async () => {
    const negada = await call('/customer-settings', {
      method: 'PUT',
      scopes: 'customers:write',
      body: JSON.stringify({ maskPhoneInList: false }),
    })

    expect(negada.status).toBe(403)
  })

  it('atributo fora do catálogo é 400, e não 500 — o corpo é que está errado', async () => {
    const recusada = await call('/customers', {
      method: 'POST',
      scopes: 'customers:write',
      body: JSON.stringify({ name: 'Anderson', attributes: { renda_secreta: 10 } }),
    })

    /*
     * `toBeGreaterThanOrEqual(400)` estava aqui antes, e passava com 500. Foi essa frouxidão que
     * escondeu o erro de domínio invisível ao filtro por quase toda a adoção do primeiro produto.
     */
    expect(recusada.status).toBe(400)
    const { rows } = await pool.query('select count(*)::int as n from "customer"."customers"')
    expect(rows[0].n).toBe(0)
  })
})
