/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Paths OpenAPI derivados da MESMA tabela de rotas que os adaptadores consomem. Rota nova ganha
 * documentação sozinha; rota removida some do spec sozinha. É o terceiro consumidor da tabela
 * declarativa (ADR 0001 §3), e a razão de a rota ser dado em vez de código.
 */

import { ROUTE_SCOPE, type NotificationRoute, type NotificationRouteTable } from '@adatechnology/notification-contracts'

export type OpenApiPaths = Record<string, Record<string, unknown>>

const SCOPE_DESCRIPTION: Record<string, string> = {
  [ROUTE_SCOPE.USER]: 'Requer usuário autenticado.',
  [ROUTE_SCOPE.ADMIN]: 'Requer credencial administrativa.',
  [ROUTE_SCOPE.SERVICE]: 'Requer credencial de serviço.',
  [ROUTE_SCOPE.PUBLIC]: 'Público — protegido por assinatura HMAC.',
}

// `/notifications/:id/read` → `/notifications/{id}/read`
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

function extractPathParameters(
  path: string,
): { name: string; in: 'path'; required: true; schema: { type: 'string' } }[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
    name: match[1] ?? '',
    in: 'path' as const,
    required: true as const,
    schema: { type: 'string' as const },
  }))
}

function buildResponses(route: NotificationRoute): Record<string, unknown> {
  const responses: Record<string, unknown> = {
    '400': { description: 'Requisição inválida — envelope `{ error: { code, message, issues } }`.' },
    '500': { description: 'Erro interno.' },
  }

  if (route.scope !== ROUTE_SCOPE.PUBLIC) {
    responses['401'] = { description: 'Sem identidade autenticada.' }
    responses['403'] = { description: 'Autenticado, mas sem o escopo exigido.' }
  }
  if (route.path.includes(':')) {
    responses['404'] = { description: 'Recurso inexistente — ou pertencente a outro usuário/empresa.' }
  }

  responses[route.method === 'POST' ? '201' : '200'] = { description: 'Sucesso.' }
  if (route.method === 'DELETE') responses['204'] = { description: 'Removido.' }

  return responses
}

export function notificationOpenApiPaths(params: { routes: NotificationRouteTable; basePath?: string }): OpenApiPaths {
  const base = (params.basePath ?? '').endsWith('/') ? (params.basePath ?? '').slice(0, -1) : (params.basePath ?? '')
  const paths: OpenApiPaths = {}

  for (const route of params.routes) {
    const openApiPath = `${base}${toOpenApiPath(route.path)}`
    paths[openApiPath] ??= {}
    ;(paths[openApiPath] as Record<string, unknown>)[route.method.toLowerCase()] = {
      operationId: route.operationId,
      summary: route.summary,
      description: SCOPE_DESCRIPTION[route.scope],
      tags: ['notifications'],
      parameters: extractPathParameters(route.path),
      // O schema zod não é convertido para JSON Schema aqui: exigiria `zod-to-json-schema` como
      // dependência do módulo só para documentação. O host que quiser o corpo detalhado no
      // Swagger converte a partir do schema exportado pelo contracts.
      requestBody: route.bodySchema
        ? { required: true, content: { 'application/json': { schema: { type: 'object' } } } }
        : undefined,
      responses: buildResponses(route),
    }
  }

  return paths
}
