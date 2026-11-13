/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const RECOMMENDATION_ERROR_CODE = {
  ITEM_NOT_FOUND: 'RECOMMENDATION_ITEM_NOT_FOUND',
  CAMPAIGN_NOT_FOUND: 'RECOMMENDATION_CAMPAIGN_NOT_FOUND',
  UNKNOWN_KIND: 'RECOMMENDATION_UNKNOWN_KIND',
  UNKNOWN_PLAN: 'RECOMMENDATION_UNKNOWN_PLAN',
  UNKNOWN_PLACEMENT: 'RECOMMENDATION_UNKNOWN_PLACEMENT',
  UNKNOWN_FIELD: 'RECOMMENDATION_UNKNOWN_FIELD',
  INVALID_FIELD_VALUE: 'RECOMMENDATION_INVALID_FIELD_VALUE',
  SPONSOR_REQUIRED: 'RECOMMENDATION_SPONSOR_REQUIRED',
  SPONSOR_NOT_ALLOWED: 'RECOMMENDATION_SPONSOR_NOT_ALLOWED',
  SPONSOR_NOT_FOUND: 'RECOMMENDATION_SPONSOR_NOT_FOUND',
  CAMPAIGN_ON_CURATED: 'RECOMMENDATION_CAMPAIGN_ON_CURATED',
  INVALID_PERIOD: 'RECOMMENDATION_INVALID_PERIOD',
  INVALID_AGE_RANGE: 'RECOMMENDATION_INVALID_AGE_RANGE',
  PLAN_NOT_ENTITLED: 'RECOMMENDATION_PLAN_NOT_ENTITLED',
  CONFIG_INVALID: 'RECOMMENDATION_CONFIG_INVALID',
} as const

export type RecommendationErrorCode = (typeof RECOMMENDATION_ERROR_CODE)[keyof typeof RECOMMENDATION_ERROR_CODE]

/**
 * O status HTTP de cada código, numa tabela só. O filtro do `module-http` reconhece erro de
 * domínio pela FORMA (`statusCode`, `code`, `message`); erro novo sem entrada aqui não compila.
 */
const STATUS_BY_CODE: Readonly<Record<RecommendationErrorCode, number>> = {
  [RECOMMENDATION_ERROR_CODE.ITEM_NOT_FOUND]: 404,
  [RECOMMENDATION_ERROR_CODE.CAMPAIGN_NOT_FOUND]: 404,
  // 400: o corpo nomeia algo que a configuração não declara.
  [RECOMMENDATION_ERROR_CODE.UNKNOWN_KIND]: 400,
  [RECOMMENDATION_ERROR_CODE.UNKNOWN_PLAN]: 400,
  [RECOMMENDATION_ERROR_CODE.UNKNOWN_PLACEMENT]: 400,
  [RECOMMENDATION_ERROR_CODE.UNKNOWN_FIELD]: 400,
  [RECOMMENDATION_ERROR_CODE.INVALID_FIELD_VALUE]: 400,
  [RECOMMENDATION_ERROR_CODE.INVALID_PERIOD]: 400,
  [RECOMMENDATION_ERROR_CODE.INVALID_AGE_RANGE]: 400,
  // 422: o corpo é válido, e a REGRA é que recusa.
  [RECOMMENDATION_ERROR_CODE.SPONSOR_REQUIRED]: 422,
  [RECOMMENDATION_ERROR_CODE.SPONSOR_NOT_ALLOWED]: 422,
  [RECOMMENDATION_ERROR_CODE.SPONSOR_NOT_FOUND]: 422,
  [RECOMMENDATION_ERROR_CODE.CAMPAIGN_ON_CURATED]: 422,
  // 402: é exatamente "precisa pagar" — a tela pode levar o anunciante para a assinatura.
  [RECOMMENDATION_ERROR_CODE.PLAN_NOT_ENTITLED]: 402,
  // Composição errada do host: quem tem de ver é o log do boot.
  [RECOMMENDATION_ERROR_CODE.CONFIG_INVALID]: 500,
}

export class RecommendationError extends Error {
  readonly statusCode: number

  constructor(
    message: string,
    readonly code: RecommendationErrorCode,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = new.target.name
    this.statusCode = STATUS_BY_CODE[code]
  }
}

export class ItemNotFoundError extends RecommendationError {
  constructor() {
    super('Recomendação não encontrada.', RECOMMENDATION_ERROR_CODE.ITEM_NOT_FOUND)
  }
}

export class CampaignNotFoundError extends RecommendationError {
  constructor() {
    super('Campanha não encontrada.', RECOMMENDATION_ERROR_CODE.CAMPAIGN_NOT_FOUND)
  }
}

export class UnknownKindError extends RecommendationError {
  constructor(kind: string) {
    super('Tipo de recomendação não declarado.', RECOMMENDATION_ERROR_CODE.UNKNOWN_KIND, { kind })
  }
}

export class UnknownPlanError extends RecommendationError {
  constructor(plan: string) {
    super('Plano não declarado.', RECOMMENDATION_ERROR_CODE.UNKNOWN_PLAN, { plan })
  }
}

export class UnknownPlacementError extends RecommendationError {
  constructor(placement: string) {
    super('Espaço não declarado.', RECOMMENDATION_ERROR_CODE.UNKNOWN_PLACEMENT, { placement })
  }
}

/** Campo fora do tipo. Aceitar criaria dado que nenhuma tela sabe desenhar. */
export class UnknownFieldError extends RecommendationError {
  constructor(name: string) {
    super('Campo não declarado para este tipo.', RECOMMENDATION_ERROR_CODE.UNKNOWN_FIELD, { name })
  }
}

export class InvalidFieldValueError extends RecommendationError {
  constructor(name: string, reason: string) {
    super('Valor inválido para o campo.', RECOMMENDATION_ERROR_CODE.INVALID_FIELD_VALUE, { name, reason })
  }
}

/** Patrocinado sem anunciante é anúncio que ninguém paga e ninguém responde. */
export class SponsorRequiredError extends RecommendationError {
  constructor() {
    super('Recomendação patrocinada precisa de um anunciante.', RECOMMENDATION_ERROR_CODE.SPONSOR_REQUIRED)
  }
}

/** Curadoria com anunciante seria anúncio sem o rótulo de patrocinado. */
export class SponsorNotAllowedError extends RecommendationError {
  constructor() {
    super('Recomendação da curadoria não tem anunciante.', RECOMMENDATION_ERROR_CODE.SPONSOR_NOT_ALLOWED)
  }
}

export class SponsorNotFoundError extends RecommendationError {
  constructor() {
    super('Anunciante não encontrado.', RECOMMENDATION_ERROR_CODE.SPONSOR_NOT_FOUND)
  }
}

export class CampaignOnCuratedError extends RecommendationError {
  constructor() {
    super('Só recomendação patrocinada tem campanha.', RECOMMENDATION_ERROR_CODE.CAMPAIGN_ON_CURATED)
  }
}

export class InvalidPeriodError extends RecommendationError {
  constructor() {
    super('O fim da campanha precisa ser depois do início.', RECOMMENDATION_ERROR_CODE.INVALID_PERIOD)
  }
}

export class InvalidAgeRangeError extends RecommendationError {
  constructor() {
    super('A idade mínima não pode passar da máxima.', RECOMMENDATION_ERROR_CODE.INVALID_AGE_RANGE)
  }
}

export class PlanNotEntitledError extends RecommendationError {
  constructor(plan: string) {
    super('O anunciante não tem este plano contratado.', RECOMMENDATION_ERROR_CODE.PLAN_NOT_ENTITLED, { plan })
  }
}

export class ConfigInvalidError extends RecommendationError {
  constructor(message: string) {
    super(message, RECOMMENDATION_ERROR_CODE.CONFIG_INVALID)
  }
}
