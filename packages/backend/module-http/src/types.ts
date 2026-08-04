/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fronteira HTTP declarativa para módulos plugáveis — **nenhum tipo de framework entra aqui**.
 *
 * Extraído do `notification-module` quando o `catalog-module` precisou da mesma coisa (regra do
 * 2º uso, `pluggable-module.md` §1). O motivo original continua valendo: expor use-cases sem
 * camada HTTP custou 1.353 linhas de cola no quickcart, e cada produto reescreveria as mesmas.
 *
 * Com a rota como dado, três consumidores saem da mesma fonte e não podem divergir: os
 * adaptadores (`/fetch`, `/uws`), os paths OpenAPI e os testes de contrato.
 */

import type { ZodTypeAny } from 'zod'

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
 * autenticação e existe para webhook, que se protege por assinatura sobre o `rawBody`.
 */
export const ROUTE_SCOPE = {
  USER: 'user',
  ADMIN: 'admin',
  SERVICE: 'service',
  PUBLIC: 'public',
} as const
export type RouteScope = (typeof ROUTE_SCOPE)[keyof typeof ROUTE_SCOPE]

export type AuthContext = {
  readonly companyId: string
  /** Ausente em rota de escopo `service`/`admin` autenticada por credencial de máquina. */
  readonly userId?: string
  readonly scopes: readonly string[]
}

/**
 * Identidade **já validada pelo host** — o módulo não verifica token nem conhece o emissor da
 * sessão (`security.md` §2). Recebe pronto e aplica autorização por objeto.
 */
export interface AuthContextResolverPort {
  resolve(params: { readonly headers: Readonly<Record<string, string>> }): Promise<AuthContext | undefined>
}

export type RequestContext = {
  readonly params: Readonly<Record<string, string>>
  readonly query: Readonly<Record<string, string>>
  /** Já validado pelo `bodySchema` da rota quando ele existe. */
  readonly body: unknown
  readonly headers: Readonly<Record<string, string>>
  /**
   * Bytes crus, preservados **antes** de qualquer parse. A assinatura HMAC de webhook é calculada
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

export type SseSubscription = { close(): void }

/**
 * `heartbeatSeconds` é parte do contrato porque o host precisa dele: o `idleTimeout` do
 * `Bun.serve` tem que ser **maior** que o heartbeat, ou a conexão morre antes do primeiro
 * batimento e a tela mostra dado velho sem erro nenhum.
 */
export type StreamResult = {
  readonly kind: 'stream'
  readonly heartbeatSeconds: number
  subscribe(emit: (event: SseEvent) => void): Promise<SseSubscription>
}

export type JsonResult = {
  readonly kind: 'json'
  readonly status: number
  readonly body: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type EmptyResult = {
  readonly kind: 'empty'
  readonly status: number
  readonly headers?: Readonly<Record<string, string>>
}

export type HttpResult = JsonResult | EmptyResult | StreamResult

export type ModuleRoute = {
  readonly method: HttpMethod
  /** Padrão com parâmetro nomeado: `/products/:id`. O adaptador traduz para o router dele. */
  readonly path: string
  readonly scope: RouteScope
  /** Escopos aceitos em `admin`/`service`; vazio significa "qualquer escopo do host". */
  readonly requiredScopes?: readonly string[]
  readonly bodySchema?: ZodTypeAny
  readonly querySchema?: ZodTypeAny
  /** Identificador estável usado no `operationId` do OpenAPI e nos testes de contrato. */
  readonly operationId: string
  readonly summary: string
  readonly handler: (context: RequestContext) => Promise<HttpResult>
}

export type ModuleRouteTable = readonly ModuleRoute[]

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

/**
 * Erro de domínio que o filtro sabe mapear. Os módulos têm hierarquias próprias e autocontidas
 * (`CatalogError`, `NotificationError`) — o filtro reconhece pela **forma**, não por herança, para
 * este pacote não virar dependência de runtime dos contracts de cada módulo.
 */
export type DomainErrorShape = {
  readonly statusCode: number
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown>
}

export function isDomainErrorShape(error: unknown): error is DomainErrorShape {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as Partial<DomainErrorShape>
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}
