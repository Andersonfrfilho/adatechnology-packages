/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Recebe o webhook de catálogo da Meta. Objeto de assinatura próprio, rota própria: o payload não
 * tem nada em comum com o de mensagens, e misturar os dois faria um handler decidir por `object`.
 */

import {
  catalogWebhookEnvelopeSchema,
  CatalogWebhookNotConfiguredError,
  InvalidCatalogWebhookSignatureError,
  type CatalogWebhookEvent,
  type ReceiveCatalogWebhookResult,
} from '@adatechnology/catalog-contracts'
import {
  buildWebhookDeliveryKey,
  isValidWebhookSignature,
  WEBHOOK_NONCE_TTL_SECONDS,
} from '@adatechnology/meta-graph-core'

import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

const WEBHOOK_NONCE_NAMESPACE = 'catalog'

/**
 * Assinaturas que sabemos rotear hoje. O que não está aqui vira `unhandled` em vez de exceção —
 * a Meta desativa webhook que responde erro com frequência, e campo novo não é falha nossa.
 */
export const HANDLED_CATALOG_WEBHOOK_FIELDS: readonly string[] = [
  'catalog_product_events',
  'product_catalog_update',
  'catalog_item_status_change',
]

export type ReceiveCatalogWebhookParams = {
  readonly rawBody: Buffer | string
  readonly signatureHeader: string | null | undefined
}

export class ReceiveCatalogWebhookUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: ReceiveCatalogWebhookParams): Promise<ReceiveCatalogWebhookResult> {
    const webhook = this.dependencies.config.webhook
    if (!webhook) throw new CatalogWebhookNotConfiguredError('config.webhook')

    const isValid = isValidWebhookSignature({
      rawBody: params.rawBody,
      signatureHeader: params.signatureHeader,
      appSecret: webhook.appSecret,
    })
    if (!isValid) throw new InvalidCatalogWebhookSignatureError()

    // A assinatura é função do corpo: dois eventos diferentes nunca colidem, e a reentrega do
    // mesmo evento colide sempre. Por isso ela serve de chave de idempotência.
    const signatureHeader = params.signatureHeader as string
    if (await this.isDuplicate(signatureHeader)) {
      return { eventsProcessed: 0, unhandledEvents: 0, duplicate: true }
    }

    return this.dispatch(params.rawBody)
  }

  private async isDuplicate(signatureHeader: string): Promise<boolean> {
    const store = this.dependencies.webhookNonceStore
    if (!store) return false

    const key = buildWebhookDeliveryKey({ namespace: WEBHOOK_NONCE_NAMESPACE, signatureHeader })
    return !(await store.setIfAbsent(key, WEBHOOK_NONCE_TTL_SECONDS))
  }

  private async dispatch(rawBody: Buffer | string): Promise<ReceiveCatalogWebhookResult> {
    const entries = this.parseEnvelope(rawBody)
    if (!entries) {
      await this.reportUnhandled({ field: undefined, reason: 'invalid-shape', value: undefined })
      return { eventsProcessed: 0, unhandledEvents: 1, duplicate: false }
    }

    const occurredAt = nowOf(this.dependencies)
    let eventsProcessed = 0
    let unhandledEvents = 0

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (!change.field || !HANDLED_CATALOG_WEBHOOK_FIELDS.includes(change.field)) {
          unhandledEvents += 1
          await this.reportUnhandled({ field: change.field, reason: 'unknown-field', value: change.value })
          continue
        }

        eventsProcessed += 1
        await this.reportEvent({
          field: change.field,
          catalogId: entry.id,
          occurredAt: entry.time ? new Date(entry.time * 1000) : occurredAt,
          value: change.value,
        })
      }
    }

    return { eventsProcessed, unhandledEvents, duplicate: false }
  }

  private parseEnvelope(rawBody: Buffer | string): readonly ParsedEntry[] | undefined {
    let payload: unknown
    try {
      payload = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    } catch {
      return undefined
    }

    const result = catalogWebhookEnvelopeSchema.safeParse(payload)
    return result.success ? (result.data.entry ?? []) : undefined
  }

  private async reportEvent(event: CatalogWebhookEvent): Promise<void> {
    const hook = this.dependencies.hooks?.onCatalogWebhookEvent
    if (!hook) return
    await runHook({ dependencies: this.dependencies, name: 'onCatalogWebhookEvent', run: () => hook(event) })
  }

  private async reportUnhandled(details: {
    readonly field: string | undefined
    readonly reason: 'unknown-field' | 'invalid-shape'
    readonly value: unknown
  }): Promise<void> {
    // O `value` fica fora do log: o payload de catálogo pode carregar dado de comprador, e log é
    // o lugar onde ele vazaria sem ninguém perceber.
    this.dependencies.logger?.warn('catalog.webhook_unhandled', { field: details.field, reason: details.reason })

    const hook = this.dependencies.hooks?.onUnhandledCatalogWebhookEvent
    if (!hook) return
    await runHook({
      dependencies: this.dependencies,
      name: 'onUnhandledCatalogWebhookEvent',
      run: () => hook(details),
    })
  }
}

/** Forma já validada pelo envelope permissivo — `unknown` só no `value`, que é do handler do field. */
type ParsedEntry = {
  readonly id?: string | undefined
  readonly time?: number | undefined
  readonly changes?: readonly { readonly field?: string | undefined; readonly value?: unknown }[] | undefined
}
