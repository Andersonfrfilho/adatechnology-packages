/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Núcleo compartilhado pelos dois adaptadores: casa a rota, valida body/query, resolve
 * identidade, checa escopo, chama o handler e converte exceção em resposta.
 *
 * Tudo que é decisão de comportamento mora aqui; `fetch.ts` e `uws.ts` só traduzem transporte.
 * É isso que faz o teste de contrato compartilhado ser possível — e é o que impede os dois
 * adaptadores de divergirem com o tempo (ADR 0001 §3).
 */

import { ROUTE_SCOPE } from './types'
import type { AuthContext, AuthContextResolverPort, LoggerPort, HttpResult, RequestContext, ModuleRoute } from './types'

import { toErrorResult } from './errorFilter'
import { compilePath, matchPath, type CompiledPath } from './pathMatcher'

// H-5: 1 MiB cobre com folga qualquer body JSON legítimo deste módulo (o maior é a lista semanal
// de disponibilidade) — upload de arquivo passa por URL pré-assinada de storage, nunca por aqui.
// Compartilhada pelos dois adaptadores (H-B) para não duplicar o número mágico e a justificativa.
export const MAX_REQUEST_BODY_BYTES = 1024 * 1024

export type CompiledRoute = {
  readonly route: ModuleRoute
  readonly compiledPath: CompiledPath
}

export type RawRequest = {
  readonly method: string
  readonly pathname: string
  readonly query: Readonly<Record<string, string | readonly string[]>>
  readonly headers: Readonly<Record<string, string>>
  readonly rawBody?: Uint8Array
  readonly ip?: string
}

/**
 * Chave repetida na query string (`?status=a&status=b`) vira array; chave única continua string
 * simples (H-F). Compartilhada pelos dois adaptadores para o parsing nunca divergir entre eles.
 */
export function parseQueryParams(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    query[key] = values.length > 1 ? values : (values[0] ?? '')
  }
  return query
}

export function compileRoutes(routes: readonly ModuleRoute[], basePath: string): CompiledRoute[] {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  return routes.map((route) => ({ route, compiledPath: compilePath(`${normalizedBase}${route.path}`) }))
}

export function findRoute(
  compiledRoutes: readonly CompiledRoute[],
  request: { method: string; pathname: string },
): { route: ModuleRoute; params: Record<string, string> } | undefined {
  for (const candidate of compiledRoutes) {
    if (candidate.route.method !== request.method) continue
    const params = matchPath(candidate.compiledPath, request.pathname)
    if (params) return { route: candidate.route, params }
  }
  return undefined
}

function parseJsonBody(rawBody: Uint8Array | undefined): unknown {
  if (!rawBody || rawBody.length === 0) return undefined
  return JSON.parse(new TextDecoder().decode(rawBody))
}

function isScopeSatisfied(route: ModuleRoute, auth: AuthContext | undefined): boolean {
  if (route.scope === ROUTE_SCOPE.PUBLIC) return true
  if (!auth) return false
  if (route.scope === ROUTE_SCOPE.USER) return auth.userId !== undefined
  // `admin`/`service`: sem `requiredScopes` declarado, basta estar autenticado — o host decide
  // o vocabulário de escopos dele, e o módulo não inventa nomes.
  if (!route.requiredScopes || route.requiredScopes.length === 0) return true
  return route.requiredScopes.some((required) => auth.scopes.includes(required))
}

export type DispatchRouteParams = {
  readonly compiledRoutes: readonly CompiledRoute[]
  readonly request: RawRequest
  readonly authResolver?: AuthContextResolverPort
  readonly logger?: LoggerPort
}

/** `undefined` = nenhuma rota do módulo casou; o host segue para o próprio 404. */
export async function dispatchRoute(params: DispatchRouteParams): Promise<HttpResult | undefined> {
  const matched = findRoute(params.compiledRoutes, params.request)
  if (!matched) return undefined

  const { route } = matched

  try {
    const auth =
      route.scope === ROUTE_SCOPE.PUBLIC
        ? undefined
        : await params.authResolver?.resolve({ headers: params.request.headers })

    if (!isScopeSatisfied(route, auth)) {
      // 401 quando não há identidade nenhuma, 403 quando há mas não basta — distinção que o
      // cliente usa para decidir entre "faça login" e "peça acesso".
      const status = auth ? 403 : 401
      return {
        kind: 'json',
        status,
        body: { error: { code: status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN', message: 'Acesso negado.' } },
      }
    }

    const body = route.bodySchema ? route.bodySchema.parse(parseJsonBody(params.request.rawBody)) : undefined
    const query = route.querySchema ? route.querySchema.parse(params.request.query) : params.request.query

    const context: RequestContext = {
      params: matched.params,
      query: query as Readonly<Record<string, string>>,
      body,
      headers: params.request.headers,
      rawBody: params.request.rawBody,
      auth,
      ip: params.request.ip,
    }

    return await route.handler(context)
  } catch (error) {
    return toErrorResult({ error, logger: params.logger })
  }
}
