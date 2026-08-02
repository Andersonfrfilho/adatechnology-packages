/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ZodTypeAny } from 'zod'
import type { AuthContext } from './providers'

/**
 * Fronteira HTTP declarativa — **nenhum tipo de framework entra neste arquivo**.
 *
 * Motivo, medido: o `meta-whatsapp-module` entrega use-cases e nada de HTTP, e o quickcart pagou
 * 1.353 linhas de cola para expô-los (`modules/conversation/infra/http/`). Nada daquilo é regra de
 * negócio — é tradução entre use-case e `Bun.serve`, que o próximo produto reescreveria divergindo.
 *
 * Com a rota como dado, três coisas derivam da mesma fonte e não podem divergir: os adaptadores
 * (`/http/fetch` e `/http/uws`), os paths OpenAPI e os testes de contrato. Adicionar um transporte
 * novo é um arquivo novo, sem tocar em lógica de rota.
 */
export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const
export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD]

/**
 * `user` exige `auth.userId`; `admin` e `service` exigem escopo declarado; `public` dispensa
 * autenticação e existe só para o webhook de recibo, que se protege por HMAC sobre o `rawBody`.
 */
export const ROUTE_SCOPE = {
  USER: 'user',
  ADMIN: 'admin',
  SERVICE: 'service',
  PUBLIC: 'public',
} as const
export type RouteScope = (typeof ROUTE_SCOPE)[keyof typeof ROUTE_SCOPE]

export type NotificationRequestContext = {
  readonly params: Readonly<Record<string, string>>
  readonly query: Readonly<Record<string, string>>
  /** Já validado pelo `bodySchema` da rota quando ele existe. */
  readonly body: unknown
  readonly headers: Readonly<Record<string, string>>
  /**
   * Bytes crus, preservados **antes** de qualquer parse. A assinatura HMAC do webhook é calculada
   * sobre eles: reserializar o JSON muda espaçamento e ordem de chave, e a verificação falha.
   */
  readonly rawBody?: Uint8Array
  /** Ausente apenas em rota `public`. */
  readonly auth?: AuthContext
  readonly ip?: string
}

export type SseEvent = {
  readonly event?: string
  readonly data: string
  readonly id?: string
}

export type SseSubscription = {
  close(): void
}

/**
 * Resultado de stream (SSE do inbox). O adaptador decide o transporte — `ReadableStream` no
 * `fetch`, `write` + `cork` no uWS — e chama `close()` quando o cliente cai (abort signal no
 * `fetch`, `onAborted` no uWS).
 *
 * `heartbeatSeconds` é parte do contrato porque o host precisa dele: o `idleTimeout` do
 * `Bun.serve` tem que ser **maior** que o heartbeat, ou a conexão morre antes do primeiro batimento
 * e a tela mostra dado velho sem erro nenhum (foi o que aconteceu no quickcart).
 */
export type NotificationStreamResult = {
  readonly kind: 'stream'
  readonly heartbeatSeconds: number
  subscribe(emit: (event: SseEvent) => void): Promise<SseSubscription>
}

export type NotificationJsonResult = {
  readonly kind: 'json'
  readonly status: number
  readonly body: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type NotificationEmptyResult = {
  readonly kind: 'empty'
  readonly status: number
  readonly headers?: Readonly<Record<string, string>>
}

export type NotificationHttpResult = NotificationJsonResult | NotificationEmptyResult | NotificationStreamResult

export type NotificationRoute = {
  readonly method: HttpMethod
  /** Padrão com parâmetro nomeado: `/notifications/:id/read`. O adaptador traduz para o seu router. */
  readonly path: string
  readonly scope: RouteScope
  /** Escopos aceitos quando `scope` é `admin`/`service`; vazio significa "qualquer escopo do host". */
  readonly requiredScopes?: readonly string[]
  readonly bodySchema?: ZodTypeAny
  readonly querySchema?: ZodTypeAny
  /** Identificador estável usado no `operationId` do OpenAPI e nos testes de contrato. */
  readonly operationId: string
  readonly summary: string
  readonly handler: (context: NotificationRequestContext) => Promise<NotificationHttpResult>
}

export type NotificationRouteTable = readonly NotificationRoute[]
