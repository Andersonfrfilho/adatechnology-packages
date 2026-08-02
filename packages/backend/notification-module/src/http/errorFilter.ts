/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Filtro único de exceção (`code-standart.md` §7): use-case não faz try/catch, controller não
 * captura — o erro propaga até aqui, que loga e responde. É o que permite o host montar as rotas
 * sem escrever um `try/catch` por endpoint.
 */

import { NotificationError } from '@adatechnology/notification-contracts'
import type { LoggerPort, NotificationJsonResult } from '@adatechnology/notification-contracts'
import { ZodError } from 'zod'

export const VALIDATION_ERROR_CODE = 'NOTIFICATION_VALIDATION_ERROR'
export const INTERNAL_ERROR_CODE = 'NOTIFICATION_INTERNAL_ERROR'

export type ValidationIssue = {
  readonly path: string
  readonly message: string
}

function errorResult(params: {
  status: number
  code: string
  message: string
  issues?: readonly ValidationIssue[]
}): NotificationJsonResult {
  return {
    kind: 'json',
    status: params.status,
    body: { error: { code: params.code, message: params.message, issues: params.issues } },
  }
}

/**
 * `ZodError` vira 400 com **todos** os problemas de uma vez, não só o primeiro (`apis.md`,
 * "Return all validation errors at once").
 */
export function toValidationResult(error: ZodError): NotificationJsonResult {
  const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  return errorResult({ status: 400, code: VALIDATION_ERROR_CODE, message: 'Requisição inválida.', issues })
}

export function toErrorResult(params: { error: unknown; logger?: LoggerPort }): NotificationJsonResult {
  if (params.error instanceof ZodError) return toValidationResult(params.error)

  if (params.error instanceof NotificationError) {
    // `details` NÃO vai para a resposta: carrega userId, deviceId e afins, que são contexto de
    // servidor. O cliente recebe código estável + mensagem; o resto vive no log.
    params.logger?.warn('notification.http.domain_error', { code: params.error.code, details: params.error.details })
    return errorResult({ status: params.error.statusCode, code: params.error.code, message: params.error.message })
  }

  // Erro desconhecido → 500 genérico, sem stack trace para o cliente (`code-standart.md` §7).
  params.logger?.error('notification.http.unhandled_error', { error: String(params.error) })
  return errorResult({ status: 500, code: INTERNAL_ERROR_CODE, message: 'Erro interno.' })
}
