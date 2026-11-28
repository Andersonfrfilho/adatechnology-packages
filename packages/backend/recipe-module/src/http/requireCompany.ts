/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { productIdSchema, RecipeUnauthenticatedError } from '@adatechnology/recipe-contracts'
import type { HttpResult, RequestContext } from '@adatechnology/module-http'

import type { ExportResult } from '../shared/exportFile'

/** `dispatchRoute` já recusa rota de admin/serviço sem identidade; isto só garante o tipo. */
export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) throw new RecipeUnauthenticatedError()
  return context.auth.companyId
}

/** `companyId` vem do token, nunca do corpo: autorização por objeto (BOLA) é por empresa. */
export function actorOf(context: RequestContext): { companyId: string; actorId?: string } {
  const companyId = requireCompany(context)
  return { companyId, ...(context.auth?.userId ? { actorId: context.auth.userId } : {}) }
}

export const json = (status: number, data: unknown): HttpResult => ({ kind: 'json', status, body: { data } })

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id de caminho inválido responde o mesmo 404 de "não existe" (nem 500 do Postgres, nem pista). */
export function uuidParam(context: RequestContext, name: string, notFound: (value: string) => Error): string {
  const value = context.params[name] ?? ''
  if (!UUID_PATTERN.test(value)) throw notFound(value)
  return value
}

export function productIdParam(context: RequestContext, notFound: (value: string) => Error): string {
  const value = context.params.productId ?? ''
  const parsed = productIdSchema.safeParse(value)
  if (!parsed.success) throw notFound(value)
  return parsed.data
}

export function fileResult(result: ExportResult): HttpResult {
  return {
    kind: 'binary',
    status: 200,
    body: typeof result.body === 'string' ? new TextEncoder().encode(result.body) : result.body,
    contentType: result.contentType,
    headers: {
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(result.rowCount),
      'X-Export-Truncated': String(result.isTruncated),
    },
  }
}
