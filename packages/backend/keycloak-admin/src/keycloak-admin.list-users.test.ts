import { describe, expect, test } from 'bun:test'

import { createKeycloakAdminClient } from '../src/index.js'
import type { KeycloakUser } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`

function buildUsers(count: number): readonly KeycloakUser[] {
  return Array.from({ length: count }, (_unused, index) => ({
    email: `pessoa-${index}@transportada.test`,
    id: `user-${index}`,
    username: `pessoa-${index}`,
  }))
}

function createClient(available: number) {
  const urls: string[] = []

  async function stubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init)
    if (request.url.startsWith(TOKEN_URL))
      return Response.json({ access_token: 'token-1', expires_in: 300, token_type: 'Bearer' })

    urls.push(request.url)
    const query = new URL(request.url).searchParams
    const first = Number(query.get('first') ?? '0')
    const max = Number(query.get('max') ?? '0')
    return Response.json(buildUsers(available).slice(first, first + max))
  }

  return {
    client: createKeycloakAdminClient({
      config: {
        baseUrl: BASE_URL,
        clientId: 'transportada-admin',
        clientSecret: 'segredo-de-service-account-para-contrato',
        realm: REALM,
      },
      fetch: stubFetch,
    }),
    urls,
  }
}

/**
 * A reconciliação precisa do realm inteiro, não de um e-mail por vez: sem esta leitura, quem existe
 * no Keycloak e não existe aqui é invisível para a tela que decide o que sincronizar.
 */
describe('listUsers — o recorte do realm', () => {
  test('devolve o limite pedido e avisa que ainda há mais', async () => {
    const { client, urls } = createClient(50)
    const page = await client.listUsers({ limit: 10 })

    expect(page.users).toHaveLength(10)
    expect(page.hasMore).toBe(true)
    // Pede um a mais que o limite: é assim que a próxima página é detectada sem uma segunda ida.
    expect(urls.at(0)).toContain('max=11')
    expect(urls.at(0)).toContain('first=0')
  })

  test('a última página não anuncia continuação', async () => {
    const { client } = createClient(15)
    const page = await client.listUsers({ first: 10, limit: 10 })

    expect(page.users).toHaveLength(5)
    expect(page.hasMore).toBe(false)
  })

  test('realm vazio devolve lista vazia, não falha', async () => {
    const { client } = createClient(0)
    expect(await client.listUsers()).toEqual({ hasMore: false, users: [] })
  })

  test('busca em branco não vira filtro', async () => {
    const { client, urls } = createClient(3)
    await client.listUsers({ search: '' })
    expect(urls.at(0)).not.toContain('search')

    await client.listUsers({ search: 'ana' })
    expect(urls.at(1)).toContain('search=ana')
  })
})
