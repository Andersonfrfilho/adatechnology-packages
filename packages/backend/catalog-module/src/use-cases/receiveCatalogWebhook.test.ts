/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'bun:test'

import type { CatalogWebhookEvent, UnhandledCatalogWebhookEventDescriptor } from '@adatechnology/catalog-contracts'

import type { CatalogDependencies } from './catalogModule.types'
import { ReceiveCatalogWebhookUseCase } from './ReceiveCatalogWebhook.use-case'

const APP_SECRET = 'segredo-do-app'

function sign(rawBody: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
}

function buildUseCase(overrides?: {
  readonly webhook?: false
  readonly events?: CatalogWebhookEvent[]
  readonly unhandled?: UnhandledCatalogWebhookEventDescriptor[]
  readonly seenKeys?: Set<string>
}) {
  const dependencies = {
    config: {
      currency: 'BRL',
      locale: 'pt-BR',
      ...(overrides?.webhook === false ? {} : { webhook: { appSecret: APP_SECRET, verifyToken: 'token' } }),
    },
    hooks: {
      onCatalogWebhookEvent: (event: CatalogWebhookEvent) => {
        overrides?.events?.push(event)
      },
      onUnhandledCatalogWebhookEvent: (details: UnhandledCatalogWebhookEventDescriptor) => {
        overrides?.unhandled?.push(details)
      },
    },
    ...(overrides?.seenKeys
      ? {
          webhookNonceStore: {
            setIfAbsent: async (key: string) => {
              const seen = overrides.seenKeys as Set<string>
              if (seen.has(key)) return false
              seen.add(key)
              return true
            },
          },
        }
      : {}),
  } as unknown as CatalogDependencies

  return new ReceiveCatalogWebhookUseCase(dependencies)
}

const CATALOG_EVENT_BODY = JSON.stringify({
  object: 'catalog',
  entry: [
    {
      id: '2277680039303874',
      time: 1_786_924_320,
      changes: [{ field: 'catalog_product_events', value: { event: 'AddToCart' } }],
    },
  ],
})

describe('ReceiveCatalogWebhookUseCase', () => {
  it('recusa corpo com assinatura inválida antes de olhar o payload', async () => {
    const useCase = buildUseCase()

    await expect(
      useCase.execute({ rawBody: CATALOG_EVENT_BODY, signatureHeader: 'sha256=deadbeef' }),
    ).rejects.toMatchObject({ code: 'CATALOG_INVALID_WEBHOOK_SIGNATURE', statusCode: 401 })
  })

  it('recusa quando o header de assinatura nem veio', async () => {
    const useCase = buildUseCase()

    await expect(useCase.execute({ rawBody: CATALOG_EVENT_BODY, signatureHeader: null })).rejects.toMatchObject({
      code: 'CATALOG_INVALID_WEBHOOK_SIGNATURE',
    })
  })

  it('falha fechado quando o webhook não está configurado', async () => {
    const useCase = buildUseCase({ webhook: false })

    await expect(
      useCase.execute({ rawBody: CATALOG_EVENT_BODY, signatureHeader: sign(CATALOG_EVENT_BODY) }),
    ).rejects.toMatchObject({ code: 'CATALOG_WEBHOOK_NOT_CONFIGURED', statusCode: 503 })
  })

  it('roteia o evento para o hook com o catálogo e o horário da própria Meta', async () => {
    const events: CatalogWebhookEvent[] = []
    const useCase = buildUseCase({ events })

    const result = await useCase.execute({
      rawBody: CATALOG_EVENT_BODY,
      signatureHeader: sign(CATALOG_EVENT_BODY),
    })

    expect(result).toEqual({ eventsProcessed: 1, unhandledEvents: 0, duplicate: false })
    expect(events).toHaveLength(1)
    expect(events[0]?.field).toBe('catalog_product_events')
    expect(events[0]?.catalogId).toBe('2277680039303874')
    expect(events[0]?.occurredAt.toISOString()).toBe(new Date(1_786_924_320_000).toISOString())
  })

  it('reporta field desconhecido como unhandled em vez de derrubar a entrega', async () => {
    const events: CatalogWebhookEvent[] = []
    const unhandled: UnhandledCatalogWebhookEventDescriptor[] = []
    const body = JSON.stringify({ entry: [{ id: 'c1', changes: [{ field: 'field_do_futuro', value: {} }] }] })
    const useCase = buildUseCase({ events, unhandled })

    const result = await useCase.execute({ rawBody: body, signatureHeader: sign(body) })

    expect(result).toEqual({ eventsProcessed: 0, unhandledEvents: 1, duplicate: false })
    expect(events).toHaveLength(0)
    expect(unhandled[0]).toMatchObject({ field: 'field_do_futuro', reason: 'unknown-field' })
  })

  it('trata corpo que não é JSON como invalid-shape, sem lançar', async () => {
    const unhandled: UnhandledCatalogWebhookEventDescriptor[] = []
    const body = 'nao-e-json'
    const useCase = buildUseCase({ unhandled })

    const result = await useCase.execute({ rawBody: body, signatureHeader: sign(body) })

    expect(result).toEqual({ eventsProcessed: 0, unhandledEvents: 1, duplicate: false })
    expect(unhandled[0]).toMatchObject({ field: undefined, reason: 'invalid-shape' })
  })

  it('não reprocessa a reentrega do mesmo evento quando há guarda de nonce', async () => {
    const events: CatalogWebhookEvent[] = []
    const useCase = buildUseCase({ events, seenKeys: new Set<string>() })
    const params = { rawBody: CATALOG_EVENT_BODY, signatureHeader: sign(CATALOG_EVENT_BODY) }

    const first = await useCase.execute(params)
    const second = await useCase.execute(params)

    expect(first.eventsProcessed).toBe(1)
    expect(second).toEqual({ eventsProcessed: 0, unhandledEvents: 0, duplicate: true })
    expect(events).toHaveLength(1)
  })

  it('hook que explode não derruba a entrega — a Meta desativa webhook que responde erro', async () => {
    const dependencies = {
      config: { currency: 'BRL', locale: 'pt-BR', webhook: { appSecret: APP_SECRET, verifyToken: 'token' } },
      hooks: {
        onCatalogWebhookEvent: () => {
          throw new Error('host quebrou')
        },
      },
    } as unknown as CatalogDependencies

    const result = await new ReceiveCatalogWebhookUseCase(dependencies).execute({
      rawBody: CATALOG_EVENT_BODY,
      signatureHeader: sign(CATALOG_EVENT_BODY),
    })

    expect(result.eventsProcessed).toBe(1)
  })
})
