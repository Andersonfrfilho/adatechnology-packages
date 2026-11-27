/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida, no mesmo molde de `content-contracts/src/errors.ts`: o `module-http`
 * reconhece pela forma (`statusCode`, `code`), sem depender do `DomainError` do host.
 */

export class CouponError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    /** Seguro para o cliente (campos, motivos): o `module-http` devolve em `error.details`. */
    public readonly publicDetails?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = 'CouponError'
  }
}

/** Campo recusado como a tela precisa para ancorar a mensagem (`web.md` §11). */
export type FieldIssue = { readonly field: string; readonly message: string }

export const COUPON_ERROR_CODES = {
  CAMPAIGN_NOT_FOUND: 'COUPON_CAMPAIGN_NOT_FOUND',
  CAMPAIGN_IN_USE: 'COUPON_CAMPAIGN_IN_USE',
  DUPLICATE_CODE: 'COUPON_DUPLICATE_CODE',
  INVALID_CODE: 'COUPON_INVALID_CODE',
  CODE_NOT_FOUND: 'COUPON_CODE_NOT_FOUND',
  WRONG_CODE_MODE: 'COUPON_WRONG_CODE_MODE',
  CODES_EXHAUSTED: 'COUPON_CODES_EXHAUSTED',
  NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
  ORDER_ALREADY_REDEEMED: 'COUPON_ORDER_ALREADY_REDEEMED',
  CAMPAIGN_UNAVAILABLE: 'COUPON_CAMPAIGN_UNAVAILABLE',
  LEAD_INVALID: 'COUPON_LEAD_INVALID',
  CONSENT_REQUIRED: 'COUPON_CONSENT_REQUIRED',
  RATE_LIMITED: 'COUPON_RATE_LIMITED',
  CONFIG_MISSING: 'COUPON_CONFIG_MISSING',
  CAMPAIGN_INVALID: 'COUPON_CAMPAIGN_INVALID',
} as const
export type CouponErrorCode = (typeof COUPON_ERROR_CODES)[keyof typeof COUPON_ERROR_CODES]

/** 404 também para campanha de outra empresa: confirmar a existência já seria vazamento. */
export class CampaignNotFoundError extends CouponError {
  constructor(public readonly reference: string) {
    super('Campanha não encontrada.', 404, COUPON_ERROR_CODES.CAMPAIGN_NOT_FOUND, { reference })
  }
}

/** Apagar campanha usada apagaria o histórico de descontos concedidos: desative em vez disso. */
export class CampaignInUseError extends CouponError {
  constructor(public readonly campaignId: string) {
    super('Campanha já tem usos ou contatos: desative em vez de excluir.', 409, COUPON_ERROR_CODES.CAMPAIGN_IN_USE, {
      campaignId,
    })
  }
}

export class DuplicateCouponCodeError extends CouponError {
  // `couponCode`, não `code`: `code` é o código do erro herdado de `CouponError`.
  constructor(public readonly couponCode: string) {
    super(
      'Já existe cupom com este código.',
      409,
      COUPON_ERROR_CODES.DUPLICATE_CODE,
      { couponCode },
      {
        fields: [{ field: 'fixedCode', message: 'Já existe cupom com este código.' }],
      },
    )
  }
}

export class InvalidCouponCodeError extends CouponError {
  constructor(public readonly field: string) {
    super('Código de cupom inválido.', 400, COUPON_ERROR_CODES.INVALID_CODE, { field })
  }
}

export class CouponCodeNotFoundError extends CouponError {
  constructor(public readonly reference: string) {
    super('Cupom não encontrado.', 404, COUPON_ERROR_CODES.CODE_NOT_FOUND, { reference })
  }
}

/** Gerar lote só existe em campanha `batch`; código fixo só em `fixed`. */
export class WrongCodeModeError extends CouponError {
  constructor(public readonly expected: string) {
    super('Operação não vale para o modo de código desta campanha.', 422, COUPON_ERROR_CODES.WRONG_CODE_MODE, {
      expected,
    })
  }
}

/** Lote sem código livre: a pessoa não recebe nada, e o painel precisa gerar mais. */
export class CodesExhaustedError extends CouponError {
  constructor(public readonly campaignId: string) {
    super('Os códigos desta campanha acabaram.', 409, COUPON_ERROR_CODES.CODES_EXHAUSTED, { campaignId })
  }
}

/** Resgate recusado: os motivos vão inteiros em `details.reasons`. */
export class CouponNotApplicableError extends CouponError {
  constructor(public readonly reasons: readonly string[]) {
    super(
      'Cupom não se aplica a este pedido.',
      422,
      COUPON_ERROR_CODES.NOT_APPLICABLE,
      { reasons: [...reasons] },
      { reasons: [...reasons] },
    )
  }
}

/** Um pedido tem uma promoção. Repetir o mesmo resgate devolve o anterior; outro código é recusado. */
export class OrderAlreadyRedeemedError extends CouponError {
  constructor(public readonly orderKind: string) {
    super('Este pedido já tem outro cupom aplicado.', 409, COUPON_ERROR_CODES.ORDER_ALREADY_REDEEMED, { orderKind })
  }
}

/** Campanha desligada, fora do período ou sem captação: o site recebe a mesma resposta para todos. */
export class CampaignUnavailableError extends CouponError {
  constructor() {
    super('Esta campanha não está disponível.', 404, COUPON_ERROR_CODES.CAMPAIGN_UNAVAILABLE)
  }
}

export type LeadFieldIssue = FieldIssue

export class InvalidLeadError extends CouponError {
  constructor(public readonly issues: readonly LeadFieldIssue[]) {
    super('Confira os dados informados.', 400, COUPON_ERROR_CODES.LEAD_INVALID, undefined, { fields: [...issues] })
  }
}

export class ConsentRequiredError extends CouponError {
  constructor() {
    super(
      'É preciso aceitar o uso dos dados para receber o cupom.',
      400,
      COUPON_ERROR_CODES.CONSENT_REQUIRED,
      undefined,
      {
        fields: [{ field: 'consent', message: 'É preciso aceitar o uso dos dados para receber o cupom.' }],
      },
    )
  }
}

export class RateLimitedError extends CouponError {
  constructor(public readonly retryAfterSeconds: number | undefined) {
    super('Muitas tentativas. Tente de novo em instantes.', 429, COUPON_ERROR_CODES.RATE_LIMITED, {
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    })
  }
}

export class CouponConfigMissingError extends CouponError {
  constructor(public readonly field: string) {
    super(`Configuração ausente ou inválida: ${field}.`, 500, COUPON_ERROR_CODES.CONFIG_MISSING, { field })
  }
}

/** Regra que cruza campos, conferida depois de juntar a edição com o que já estava salvo. */
export class InvalidCampaignError extends CouponError {
  constructor(public readonly issues: readonly LeadFieldIssue[]) {
    super('Confira a campanha.', 400, COUPON_ERROR_CODES.CAMPAIGN_INVALID, undefined, { fields: [...issues] })
  }
}
