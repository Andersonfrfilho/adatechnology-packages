/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraError } from './infraBase.error'
import { INFRA_ERROR_CODES } from './infraErrorCode.constant'

const FORBIDDEN = 403
const CONFLICT = 409
const LOCKED = 423
const UNPROCESSABLE_ENTITY = 422
const SERVICE_UNAVAILABLE = 503

// Mensagens sem o valor do segredo, sem o workspace e sem dizer qual parte da confirmacao falhou.

export class InfraSecretKeyMissingError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_SECRET_KEY_MISSING,
      message: 'Chave de cifra da infraestrutura nao configurada',
      statusCode: SERVICE_UNAVAILABLE,
    })
  }
}

export class InfraIntegrationProductionOnlyError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_PRODUCTION_ONLY,
      message: 'A integracao do Railway so pode ser alterada em producao',
      statusCode: FORBIDDEN,
    })
  }
}

export class InfraIntegrationPasswordInvalidError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_PASSWORD_INVALID,
      message: 'Senha nao confirmada',
      statusCode: FORBIDDEN,
    })
  }
}

/** Depois de 5 falhas de senha o agente fica bloqueado; `retryAfterSeconds` vai ao header Retry-After. */
export class InfraIntegrationLockedError extends InfraError {
  constructor(retryAfterSeconds: number) {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_LOCKED,
      message: 'Muitas tentativas de confirmacao; tente novamente em instantes',
      statusCode: LOCKED,
      context: { retryAfterSeconds },
    })
  }
}

export class InfraIntegrationTokenRejectedError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_TOKEN_REJECTED,
      message: 'O Railway recusou esta credencial',
      statusCode: UNPROCESSABLE_ENTITY,
    })
  }
}

/** Credencial de conta: a query `me` responde para ela, e uma credencial de workspace nao deve responder. */
export class InfraIntegrationTokenTooBroadError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_TOKEN_TOO_BROAD,
      message: 'Use uma credencial de workspace do Railway, nao de conta',
      statusCode: UNPROCESSABLE_ENTITY,
    })
  }
}

export class InfraIntegrationWorkspaceNotFoundError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_WORKSPACE_NOT_FOUND,
      message: 'Workspace do Railway nao encontrado ou sem acesso para esta credencial',
      statusCode: UNPROCESSABLE_ENTITY,
    })
  }
}

/** Com a credencial na variavel de ambiente, o painel nao pode trocar nem remover: a fonte e unica. */
export class InfraIntegrationEnvironmentManagedError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_ENVIRONMENT_MANAGED,
      message: 'A credencial vem da variavel de ambiente do servidor e nao pode ser alterada pelo painel',
      statusCode: CONFLICT,
    })
  }
}

/** Outra requisicao trocou ou removeu a linha no mesmo instante: repetir o PUT resolve. */
export class InfraIntegrationConcurrentChangeError extends InfraError {
  constructor() {
    super({
      code: INFRA_ERROR_CODES.INFRA_INTEGRATION_CONCURRENT_CHANGE,
      message: 'A integracao foi alterada por outra requisicao; tente novamente',
      statusCode: CONFLICT,
    })
  }
}
