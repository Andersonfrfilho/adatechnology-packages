import { describe, expect, test } from 'bun:test'

import { createKeycloakAdminClient } from '../src/index.js'
import type { KeycloakGroup } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`
const GROUP_ID = 'b1c2d3e4-0000-4000-8000-ffffffffffff'
const USER_ID = 'a1b2c3d4-0000-4000-8000-ffffffffffff'

type Recorded = { readonly body: string; readonly method: string; readonly url: string }

function createClient(input: { readonly groups?: readonly KeycloakGroup[] } = {}) {
  const requests: Recorded[] = []

  async function stubFetch(target: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(target, init)
    if (request.url.startsWith(TOKEN_URL))
      return Response.json({ access_token: 'token-1', expires_in: 300, token_type: 'Bearer' })

    const body = request.method === 'GET' || request.method === 'DELETE' ? '' : await request.text()
    requests.push({ body, method: request.method, url: request.url })

    if (request.method === 'POST') {
      return new Response(null, {
        headers: { location: `${BASE_URL}/admin/realms/${REALM}/groups/${GROUP_ID}` },
        status: 201,
      })
    }
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams
      const first = Number(query.get('first') ?? '0')
      const max = Number(query.get('max') ?? '0')
      return Response.json((input.groups ?? []).slice(first, first + max))
    }
    return new Response(null, { status: 204 })
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
    requests,
  }
}

function groupsOf(count: number): readonly KeycloakGroup[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `group-${index}`,
    name: `Grupo ${index}`,
  }))
}

/**
 * O produto cria o grupo do lado dele e precisa do mesmo grupo no realm: sem estas operações os dois
 * lados divergem no primeiro cadastro, e a sincronização vira trabalho manual no console.
 */
describe('grupos do realm', () => {
  test('cria o grupo e devolve o id que o Keycloak escolheu', async () => {
    const { client, requests } = createClient()

    const created = await client.createGroup({ name: 'Financeiro' })

    expect(created.id).toBe(GROUP_ID)
    expect(requests[0]?.method).toBe('POST')
    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({ name: 'Financeiro' })
  })

  /** O Keycloak guarda atributo como lista, mesmo quando o valor é um só. */
  test('normaliza atributo na criação', async () => {
    const { client, requests } = createClient()

    await client.createGroup({ attributes: { company_id: 'company-1' }, name: 'Fiscal' })

    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
      attributes: { company_id: ['company-1'] },
      name: 'Fiscal',
    })
  })

  test('renomeia sem apagar o que não foi mandado', async () => {
    const { client, requests } = createClient()

    await client.updateGroup({ group: { name: 'Financeiro sênior' }, groupId: GROUP_ID })

    expect(requests[0]?.method).toBe('PUT')
    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({ name: 'Financeiro sênior' })
  })

  test('apaga o grupo pelo id', async () => {
    const { client, requests } = createClient()

    await client.deleteGroup({ groupId: GROUP_ID })

    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url).toContain(`/groups/${GROUP_ID}`)
  })
})

describe('a lista de grupos', () => {
  test('devolve o limite pedido e avisa que há mais', async () => {
    const { client, requests } = createClient({ groups: groupsOf(50) })

    const page = await client.listGroups({ limit: 10 })

    expect(page.groups).toHaveLength(10)
    expect(page.hasMore).toBe(true)
    // Pede um a mais que o limite: é assim que a próxima página é detectada sem segunda ida.
    expect(requests[0]?.url).toContain('max=11')
  })

  test('a última página não anuncia continuação', async () => {
    const { client } = createClient({ groups: groupsOf(3) })

    expect((await client.listGroups({ limit: 10 })).hasMore).toBe(false)
  })

  test('realm sem grupo devolve lista vazia, não falha', async () => {
    const { client } = createClient()

    expect(await client.listGroups()).toEqual({ groups: [], hasMore: false })
  })

  test('busca em branco não vira filtro', async () => {
    const { client, requests } = createClient({ groups: groupsOf(2) })

    await client.listGroups({ search: '' })
    await client.listGroups({ search: 'fisc' })

    expect(requests[0]?.url).not.toContain('search')
    expect(requests[1]?.url).toContain('search=fisc')
  })
})

/**
 * A filiação é endereçada pelo **usuário**, não pelo grupo: `PUT` para entrar e `DELETE` para sair,
 * no mesmo caminho. Trocar a ordem dos ids monta uma URL que o Keycloak aceita e que liga outra
 * pessoa a outro grupo — erro que responde 204 e não aparece em lugar nenhum.
 */
describe('filiação ao grupo', () => {
  test('entra no grupo pelo caminho do usuário', async () => {
    const { client, requests } = createClient()

    await client.addUserToGroup({ groupId: GROUP_ID, userId: USER_ID })

    expect(requests[0]?.method).toBe('PUT')
    expect(requests[0]?.url).toContain(`/users/${USER_ID}/groups/${GROUP_ID}`)
  })

  test('sai do grupo pelo mesmo caminho', async () => {
    const { client, requests } = createClient()

    await client.removeUserFromGroup({ groupId: GROUP_ID, userId: USER_ID })

    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url).toContain(`/users/${USER_ID}/groups/${GROUP_ID}`)
  })
})
