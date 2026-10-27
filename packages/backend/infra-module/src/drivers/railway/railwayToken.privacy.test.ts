/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { inspect } from 'node:util'

import { z } from 'zod'

import { RailwayGateway } from './RailwayGateway'
import { RailwayGraphqlClient } from './RailwayGraphqlClient'

const DECOY = 'ISCA-TOKEN-0123456789'

type SeenRequest = { authorization: string | undefined }

function buildFetch(seen: SeenRequest[]): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    seen.push({ authorization: (init.headers as Record<string, string>).Authorization })
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

function collectRepresentations(subject: object): readonly string[] {
  return [
    JSON.stringify(subject),
    JSON.stringify(Object.keys(subject)),
    JSON.stringify(Object.getOwnPropertyNames(subject)),
    String(subject),
    Bun.inspect(subject),
    inspect(subject, { showHidden: true, depth: 6 }),
  ]
}

function buildClient(seen: SeenRequest[]): RailwayGraphqlClient {
  return new RailwayGraphqlClient({ token: DECOY, fetchImplementation: buildFetch(seen), now: Date.now })
}

function buildGateway(seen: SeenRequest[]): RailwayGateway {
  return new RailwayGateway({ token: DECOY, workspaceId: 'ws-1', fetchImplementation: buildFetch(seen) })
}

describe('RailwayGraphqlClient guarda o token fora de qualquer representacao', () => {
  it.each(collectRepresentations(buildClient([])).map((text, index) => [index, text] as const))(
    'representacao %i do cliente nao contem a isca',
    (_index, text) => {
      expect(text).not.toContain(DECOY)
    },
  )

  it('continua enviando o token no header Authorization', async () => {
    const seen: SeenRequest[] = []
    await buildClient(seen).execute({
      operationName: 'Probe',
      query: 'query { ok }',
      variables: {},
      schema: z.object({ ok: z.boolean() }),
    })

    expect(seen).toEqual([{ authorization: `Bearer ${DECOY}` }])
  })
})

describe('RailwayGateway guarda o token fora de qualquer representacao', () => {
  it.each(collectRepresentations(buildGateway([])).map((text, index) => [index, text] as const))(
    'representacao %i do gateway nao contem a isca',
    (_index, text) => {
      expect(text).not.toContain(DECOY)
    },
  )
})
