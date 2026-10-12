/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RailwayInfraError } from './railwayInfra.error'
import { RAILWAY_INFRA_ERROR_CODES } from './railwayInfraErrorCode.constant'
import type { InfraSecretUnreadableReason } from './infraSecret.constant'

// 503: falha de configuracao/dado do servidor, nunca erro do cliente nem bug a ser repetido.
const SERVICE_UNAVAILABLE = 503

/** A mensagem nunca inclui o valor da chave: so o fato de que ela e invalida. */
export class InfraSecretKeyInvalidError extends RailwayInfraError {
  constructor() {
    super({
      code: RAILWAY_INFRA_ERROR_CODES.INFRA_SECRET_KEY_INVALID,
      message: 'Chave de cifra da infraestrutura invalida',
      statusCode: SERVICE_UNAVAILABLE,
    })
  }
}

/** Carrega so o motivo de enum fixo: texto claro, cifrado e chave nunca entram aqui. */
export class InfraSecretUnreadableError extends RailwayInfraError {
  readonly reason: InfraSecretUnreadableReason

  constructor(reason: InfraSecretUnreadableReason) {
    super({
      code: RAILWAY_INFRA_ERROR_CODES.INFRA_SECRET_UNREADABLE,
      message: 'Segredo da infraestrutura ilegivel',
      statusCode: SERVICE_UNAVAILABLE,
      context: { reason },
    })
    this.reason = reason
  }
}
