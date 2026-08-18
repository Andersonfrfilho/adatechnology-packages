/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { CatalogModule } from '../CatalogModule'
import { createCatalogRoutes } from './routes'
import { buildCatalogWebhookRoutes, CATALOG_WEBHOOK_PATH } from './webhookRoutes'

const VERIFY_TOKEN = 'token-do-desafio'

function buildModule(withWebhook: boolean): CatalogModule {
  return {
    config: {
      currency: 'BRL',
      locale: 'pt-BR',
      ...(withWebhook ? { webhook: { appSecret: 'segredo', verifyToken: VERIFY_TOKEN } } : {}),
    },
    useCases: {
      ...(withWebhook
        ? {
            receiveCatalogWebhook: {
              execute: async () => ({ eventsProcessed: 1, unhandledEvents: 0, duplicate: false }),
            },
          }
        : {}),
    },
  } as unknown as CatalogModule
}

function buildContext(query: Record<string, string>) {
  return { params: {}, query, body: undefined, headers: {} }
}

describe('buildCatalogWebhookRoutes', () => {
  it('não publica rota nenhuma sem webhook configurado — a URL simplesmente não existe', () => {
    expect(buildCatalogWebhookRoutes(buildModule(false))).toHaveLength(0)
    expect(createCatalogRoutes({ module: buildModule(false) }).some((r) => r.path === CATALOG_WEBHOOK_PATH)).toBe(false)
  })

  it('publica GET e POST públicos no caminho próprio do catálogo', () => {
    const routes = buildCatalogWebhookRoutes(buildModule(true))

    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      `GET ${CATALOG_WEBHOOK_PATH}`,
      `POST ${CATALOG_WEBHOOK_PATH}`,
    ])
    expect(routes.every((route) => route.scope === 'public')).toBe(true)
  })

  it('ecoa o desafio como texto puro — em JSON a Meta reprova a URL', async () => {
    const [challengeRoute] = buildCatalogWebhookRoutes(buildModule(true))

    const result = await challengeRoute!.handler(
      buildContext({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': '1158201444',
      }) as never,
    )

    expect(result).toEqual({ kind: 'text', status: 200, body: '1158201444' })
  })

  it('recusa o desafio com token errado', async () => {
    const [challengeRoute] = buildCatalogWebhookRoutes(buildModule(true))

    await expect(
      challengeRoute!.handler(
        buildContext({ 'hub.mode': 'subscribe', 'hub.verify_token': 'errado', 'hub.challenge': '1' }) as never,
      ),
    ).rejects.toMatchObject({ code: 'CATALOG_INVALID_WEBHOOK_SIGNATURE' })
  })
})
