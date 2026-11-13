/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { RailwayGateway } from './drivers/railway/RailwayGateway'
import { probeWorkspace } from './probeWorkspace'
import { PROBE_WORKSPACE_OUTCOME } from '@adatechnology/infra-contracts'

const BAIT_TOKEN = 'ISCA-TOKEN-0123456789'
const WORKSPACE_ID = 'workspace-uuid-1'
const NOW = Date.parse('2026-10-09T12:00:00.000Z')

type Reply = () => Response | Promise<Response>

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Reply {
  return () => new Response(JSON.stringify(body), { status, headers })
}

const WORKSPACE_OK = json({ data: { workspace: { id: WORKSPACE_ID, name: 'Ada' } } })
const NOT_AUTHORIZED = json({ errors: [{ message: 'Not Authorized' }], data: null })

function scripted(replies: readonly Reply[]) {
  const requests: { readonly init: RequestInit | undefined }[] = []
  const fetchImplementation = (async (_url: unknown, init?: RequestInit) => {
    requests.push({ init })
    const reply = replies[requests.length - 1]
    if (reply === undefined) throw new Error('unexpected request')
    return reply()
  }) as unknown as typeof fetch
  return { fetchImplementation, requests }
}

async function probe(replies: readonly Reply[], workspaceId = WORKSPACE_ID) {
  const { fetchImplementation, requests } = scripted(replies)
  const result = await probeWorkspace({ token: BAIT_TOKEN, workspaceId, fetchImplementation, now: () => NOW })
  return { result, requests }
}

describe('probeWorkspace', () => {
  it('ok: workspace certo e `me` negado', async () => {
    const { result, requests } = await probe([WORKSPACE_OK, NOT_AUTHORIZED])
    expect(result).toEqual({ outcome: 'ok' })
    expect(requests).toHaveLength(2)
  })

  it('token_rejected: HTTP 401, 403 e Not Authorized no workspace', async () => {
    for (const reply of [json({}, 401), json({}, 403), NOT_AUTHORIZED]) {
      expect((await probe([reply])).result).toEqual({ outcome: 'token_rejected' })
    }
  })

  it('workspace_not_found: null, id diferente e mensagem not found', async () => {
    const replies = [
      json({ data: { workspace: null } }),
      json({ data: { workspace: { id: 'outro', name: 'x' } } }),
      json({ errors: [{ message: 'Workspace not found' }], data: null }),
    ]
    for (const reply of replies) {
      const { result, requests } = await probe([reply])
      expect(result).toEqual({ outcome: 'workspace_not_found' })
      expect(requests).toHaveLength(1)
    }
  })

  it('too_broad: `me` responde com dados', async () => {
    const { result } = await probe([WORKSPACE_OK, json({ data: { me: { id: 'user-1' } } })])
    expect(result).toEqual({ outcome: 'too_broad' })
  })

  it('unavailable: rede, 502, JSON invalido e schema invalido', async () => {
    const replies: Reply[] = [
      () => {
        throw new Error('network down')
      },
      json({}, 502),
      () => new Response('<html>', { status: 200 }),
      json({ data: { workspace: { id: 5 } } }),
    ]
    for (const reply of replies) {
      expect((await probe([reply])).result).toEqual({ outcome: 'unavailable' })
    }
  })

  it('unavailable (fail closed): `me` falha por 502 ou rede depois de workspace ok', async () => {
    const networkFailure: Reply = () => {
      throw new Error('network down')
    }
    for (const reply of [json({}, 502), networkFailure]) {
      expect((await probe([WORKSPACE_OK, reply])).result).toEqual({ outcome: 'unavailable' })
    }
  })

  it('rate_limited: Retry-After, padrao e teto', async () => {
    const cases: readonly [Record<string, string>, number][] = [
      [{ 'Retry-After': '7' }, 7],
      [{}, 30],
      [{ 'Retry-After': '999999' }, 300],
    ]
    for (const [headers, seconds] of cases) {
      const { result } = await probe([json({}, 429, headers)])
      expect(result).toEqual({ outcome: 'rate_limited', retryAfterSeconds: seconds })
    }
  })

  it('rate_limited tambem quando o 429 vem na consulta de `me`', async () => {
    const { result } = await probe([WORKSPACE_OK, json({}, 429, { 'Retry-After': '7' })])
    expect(result).toEqual({ outcome: 'rate_limited', retryAfterSeconds: 7 })
  })

  it('envia o id por variables, sem interpolar na query, com o Bearer correto', async () => {
    const { requests } = await probe([WORKSPACE_OK, NOT_AUTHORIZED])
    const first = requests[0]?.init
    const body = JSON.parse(String(first?.body)) as { query: string; variables: Record<string, string> }
    expect(body.variables).toEqual({ workspaceId: WORKSPACE_ID })
    expect(body.query).not.toContain(WORKSPACE_ID)
    expect((first?.headers as Record<string, string>).Authorization).toBe(`Bearer ${BAIT_TOKEN}`)
    const second = JSON.parse(String(requests[1]?.init?.body)) as { query: string }
    expect(second.query).toContain('me')
  })

  it('o token nunca aparece no resultado', async () => {
    const outcomes = [
      await probe([WORKSPACE_OK, NOT_AUTHORIZED]),
      await probe([json({}, 401)]),
      await probe([json({}, 429, { 'Retry-After': '7' })]),
      await probe([json({}, 502)]),
    ]
    for (const { result } of outcomes) expect(JSON.stringify(result)).not.toContain(BAIT_TOKEN)
    expect(Object.values(PROBE_WORKSPACE_OUTCOME)).toContain('ok')
  })

  it('cliente descartavel: 429 do probe nao bloqueia o gateway em uso', async () => {
    let gatewayCalls = 0
    const sharedFetch = (async (_url: unknown, init?: RequestInit) => {
      if (String(init?.body).includes('ProbeWorkspace')) {
        return new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })
      }
      gatewayCalls += 1
      return WORKSPACE_OK()
    }) as unknown as typeof fetch
    const gateway = new RailwayGateway({
      token: BAIT_TOKEN,
      workspaceId: WORKSPACE_ID,
      fetchImplementation: sharedFetch,
      now: () => NOW,
    })
    const limited = await probeWorkspace({
      token: BAIT_TOKEN,
      workspaceId: WORKSPACE_ID,
      fetchImplementation: sharedFetch,
      now: () => NOW,
    })
    expect(limited.outcome).toBe('rate_limited')

    await gateway.verifyAccess()
    expect(gatewayCalls).toBeGreaterThan(0)
  })

  it('cliente descartavel: 429 do gateway nao bloqueia o probe', async () => {
    const fetchImplementation = (async (_url: unknown, init?: RequestInit) => {
      if (String(init?.body).includes('VerifyWorkspace'))
        return new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })
      if (String(init?.body).includes('ProbeAccountScope')) return NOT_AUTHORIZED()
      return WORKSPACE_OK()
    }) as unknown as typeof fetch
    const gateway = new RailwayGateway({
      token: BAIT_TOKEN,
      workspaceId: WORKSPACE_ID,
      fetchImplementation,
      now: () => NOW,
    })
    await gateway.verifyAccess()
    await gateway.verifyAccess()
    const result = await probeWorkspace({
      token: BAIT_TOKEN,
      workspaceId: WORKSPACE_ID,
      fetchImplementation,
      now: () => NOW,
    })
    expect(result).toEqual({ outcome: 'ok' })
  })

  it('um probe nao herda o bloqueio de outro probe', async () => {
    const first = await probe([json({}, 429, { 'Retry-After': '120' })])
    expect(first.result.outcome).toBe('rate_limited')
    const second = await probe([WORKSPACE_OK, NOT_AUTHORIZED])
    expect(second.result).toEqual({ outcome: 'ok' })
  })
})
