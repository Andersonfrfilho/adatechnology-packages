/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Webhook de catálogo da Meta. É um **objeto de assinatura próprio**, separado do WhatsApp
 * Business Account: a Meta configura callback por objeto, com payload de formato diferente. Por
 * isso ele tem rota própria em vez de dividir a de mensagens.
 */

import { z } from 'zod'

/**
 * O envelope é validado de forma permissiva de propósito.
 *
 * Validar como união fechada faz a Meta quebrar o webhook toda vez que adiciona campo numa versão
 * nova da API — e webhook que responde erro com frequência é desativado por ela. A validação
 * estrita acontece por evento, contra o schema do próprio `field`.
 */
export const catalogWebhookChangeSchema = z.object({
  /** Qual assinatura disparou. Sem ele não há como rotear evento nenhum. */
  field: z.string().optional(),
  value: z.object({}).passthrough().optional(),
})

export const catalogWebhookEntrySchema = z.object({
  /** Id do objeto que originou o evento — para catálogo, o próprio `catalog_id`. */
  id: z.string().optional(),
  time: z.number().optional(),
  changes: z.array(catalogWebhookChangeSchema).optional(),
})

export const catalogWebhookEnvelopeSchema = z.object({
  object: z.string().optional(),
  entry: z.array(catalogWebhookEntrySchema).optional(),
})

export type CatalogWebhookEnvelope = z.infer<typeof catalogWebhookEnvelopeSchema>
export type CatalogWebhookChange = z.infer<typeof catalogWebhookChangeSchema>

/**
 * Um evento já roteado: sabemos de qual catálogo veio e qual assinatura disparou, e o corpo ainda
 * é cru porque o schema estrito é responsabilidade de quem trata aquele `field`.
 */
export type CatalogWebhookEvent = {
  readonly field: string
  readonly catalogId: string | undefined
  readonly occurredAt: Date
  readonly value: unknown
}

export type UnhandledCatalogWebhookEventDescriptor = {
  /** O `changes[].field` como a Meta mandou; `undefined` quando o payload nem trouxe o campo. */
  readonly field: string | undefined
  /** Sem handler para o field, ou corpo que não bate com o schema dele. */
  readonly reason: 'unknown-field' | 'invalid-shape'
  /** O `value` cru, para diagnóstico. Nunca logar inteiro: pode conter dado de cliente. */
  readonly value: unknown
}

export type ReceiveCatalogWebhookResult = {
  readonly eventsProcessed: number
  readonly unhandledEvents: number
  /** `true` = a Meta reentregou algo já processado e nada foi executado de novo. */
  readonly duplicate: boolean
}
