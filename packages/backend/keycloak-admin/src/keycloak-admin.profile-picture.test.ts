import { describe, expect, test } from 'bun:test'

import { createKeycloakAdminClient, PROFILE_PICTURE_ATTRIBUTE } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`
const USER_ID = 'a1b2c3d4-0000-4000-8000-ffffffffffff'

type Recorded = { readonly body: string; readonly method: string }

function createClient(current: Readonly<Record<string, unknown>>) {
  const requests: Recorded[] = []

  async function stubFetch(target: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(target, init)
    if (request.url.startsWith(TOKEN_URL))
      return Response.json({ access_token: 'token-1', expires_in: 300, token_type: 'Bearer' })

    if (request.method === 'GET') return Response.json(current)

    requests.push({ body: await request.text(), method: request.method })
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

/**
 * O nome do atributo é `picture` porque é o que o OIDC reserva para isso: com um mapeador do realm,
 * a foto chega ao token e a tela não precisa de uma consulta por pessoa para desenhar um avatar.
 */
describe('foto de perfil', () => {
  test('grava a URL no atributo padrão do OIDC', async () => {
    const { client, requests } = createClient({ attributes: {}, id: USER_ID })

    await client.setProfilePicture({ pictureUrl: 'https://cdn.test/ana.png', userId: USER_ID })

    expect(requests[0]?.method).toBe('PUT')
    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
      attributes: { [PROFILE_PICTURE_ATTRIBUTE]: ['https://cdn.test/ana.png'] },
    })
  })

  /**
   * O Admin API **substitui o conjunto** de atributos. Mandar só a foto apagaria `company_id` e
   * qualquer outro atributo do produto — e o sintoma apareceria longe daqui: login entrando sem
   * empresa, horas depois, sem nada ligando um ao outro.
   */
  test('preserva os atributos que o produto já guardava', async () => {
    const { client, requests } = createClient({
      attributes: { company_id: ['company-1'], tax_id: ['12345678909'] },
      id: USER_ID,
    })

    await client.setProfilePicture({ pictureUrl: 'https://cdn.test/ana.png', userId: USER_ID })

    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
      attributes: {
        company_id: ['company-1'],
        [PROFILE_PICTURE_ATTRIBUTE]: ['https://cdn.test/ana.png'],
        tax_id: ['12345678909'],
      },
    })
  })

  test('tirar a foto remove só ela', async () => {
    const { client, requests } = createClient({
      attributes: { company_id: ['company-1'], picture: ['https://cdn.test/ana.png'] },
      id: USER_ID,
    })

    await client.setProfilePicture({ pictureUrl: undefined, userId: USER_ID })

    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
      attributes: { company_id: ['company-1'] },
    })
  })

  /** URL vazia é ausência de foto, não uma foto chamada "". */
  test('URL em branco também tira a foto', async () => {
    const { client, requests } = createClient({
      attributes: { picture: ['https://cdn.test/ana.png'] },
      id: USER_ID,
    })

    await client.setProfilePicture({ pictureUrl: '', userId: USER_ID })

    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({ attributes: {} })
  })

  test('usuário sem atributo nenhum não quebra a leitura', async () => {
    const { client, requests } = createClient({ id: USER_ID })

    await client.setProfilePicture({ pictureUrl: 'https://cdn.test/ana.png', userId: USER_ID })

    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({
      attributes: { [PROFILE_PICTURE_ATTRIBUTE]: ['https://cdn.test/ana.png'] },
    })
  })
})
