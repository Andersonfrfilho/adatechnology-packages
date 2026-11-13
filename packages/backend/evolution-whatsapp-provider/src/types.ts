/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type EvolutionFetch = (url: string, init: RequestInit) => Promise<Response>

export type EvolutionConfig = {
  /** Base da instância do Evolution, sem barra final (ex.: https://evolution.exemplo.com). */
  baseUrl: string
  /** Nome da instância (um número conectado por instância). */
  instance: string
  /** Chave da instância ou global; vai só no cabeçalho `apikey`, nunca em log nem em URL. */
  apiKey: string
  /** Tempo máximo de cada chamada. Padrão 15 s. */
  timeoutMs?: number
  /** Injetável para teste; padrão `fetch` global. */
  fetch?: EvolutionFetch
}

export type EvolutionSendResult = { externalMessageId: string | null }

export type EvolutionConnectionState = 'open' | 'connecting' | 'close'

/** Mesmo vocabulário de estado de entrega do canal Meta (`whatsAppMessageStatusSchema`). */
export type EvolutionDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed'
