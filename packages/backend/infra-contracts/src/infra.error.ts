/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraError } from './infraBase.error'
import { INFRA_ERROR_CODES } from './infraErrorCode.constant'

const BAD_REQUEST = 400
const FORBIDDEN = 403
const NOT_FOUND = 404
const CONFLICT = 409
const BAD_GATEWAY = 502
const SERVICE_UNAVAILABLE = 503

/** Sem token do Railway a infra nao existe: o painel mostra "nao configurado", nunca lista vazia. */
export class InfraNotConfiguredError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_NOT_CONFIGURED,
      message: 'Infraestrutura Railway nao configurada',
      statusCode: SERVICE_UNAVAILABLE,
    })
  }
}

export class InfraEnvironmentProtectedError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_ENVIRONMENT_PROTECTED,
      message: 'Este ambiente e protegido e nao pode ser desligado pelo painel',
      statusCode: FORBIDDEN,
    })
  }
}

export class InfraEnvironmentNotFoundError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_ENVIRONMENT_NOT_FOUND,
      message: 'Ambiente nao encontrado',
      statusCode: NOT_FOUND,
    })
  }
}

export class InfraOperationInProgressError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_OPERATION_IN_PROGRESS,
      message: 'Ja existe uma operacao em andamento neste ambiente',
      statusCode: CONFLICT,
    })
  }
}

export class InfraOperationNotFoundError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_OPERATION_NOT_FOUND,
      message: 'Operacao nao encontrada',
      statusCode: NOT_FOUND,
    })
  }
}

/** A Railway API falhou ou respondeu algo inesperado. O detalhe fica no log, nunca na resposta. */
export class InfraProviderRequestFailedError extends InfraError {
  constructor(operation: string) {
    super({
      code: INFRA_ERROR_CODES.INFRA_PROVIDER_REQUEST_FAILED,
      message: 'Nao foi possivel falar com o Railway',
      statusCode: BAD_GATEWAY,
      context: { operation },
    })
  }
}

/** O Railway respondeu, mas recusou: `isAuthFailure` separa token invalido de qualquer outra recusa. */
export class InfraProviderRejectedError extends InfraProviderRequestFailedError {
  constructor(params: { readonly operation: string; readonly isAuthFailure: boolean; readonly isNotFound?: boolean }) {
    super(params.operation)
    this.isAuthFailure = params.isAuthFailure
    this.isNotFound = params.isNotFound ?? false
  }

  readonly isAuthFailure: boolean
  readonly isNotFound: boolean
}

export class InfraProviderRateLimitedError extends InfraError {
  constructor(retryAfterSeconds?: number) {
    super({
      code: INFRA_ERROR_CODES.INFRA_PROVIDER_RATE_LIMITED,
      message: 'Limite de requisicoes do Railway atingido; tente novamente em instantes',
      statusCode: SERVICE_UNAVAILABLE,
      ...(retryAfterSeconds !== undefined ? { context: { retryAfterSeconds } } : {}),
    })
  }
}

/** Ligar fora da janela de uma agenda ativa exige dizer ate quando o ambiente deve ficar ligado. */
export class InfraKeepOnUntilRequiredError extends InfraError {
  constructor(message = 'Informe ate quando o ambiente deve ficar ligado') {
    super({
      code: INFRA_ERROR_CODES.INFRA_KEEP_ON_UNTIL_REQUIRED,
      message,
      statusCode: BAD_REQUEST,
    })
  }
}

export class InfraInvalidScheduleError extends InfraError {
  constructor(message = 'Agenda invalida: confira os dias, os horarios e se o ligar e anterior ao desligar') {
    super({
      code: INFRA_ERROR_CODES.INFRA_INVALID_SCHEDULE,
      message,
      statusCode: BAD_REQUEST,
    })
  }
}

export class InfraServiceNotFoundError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_SERVICE_NOT_FOUND,
      message: 'Servico nao encontrado neste ambiente',
      statusCode: NOT_FOUND,
    })
  }
}
