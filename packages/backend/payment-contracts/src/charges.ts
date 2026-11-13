/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cobrança avulsa: o host cria uma cobrança (pedido de restaurante, compra única) e manda para a
 * pessoa pagar fora do app, por Pix ou por link de cartão. Diferente do checkout de assinatura, quem
 * gera o link é o provedor, na hora, pela API dele.
 *
 * É uma capacidade à parte (`ChargeProviderPort`) e não um método a mais no `PaymentProviderPort`:
 * a Hotmart não cobra avulso, o Mercado Pago sim. O host pergunta com `supportsCharges(provider)`.
 *
 * A credencial é de quem recebe. Num produto com várias empresas (cada restaurante com a conta
 * dele), o host cria um provedor por empresa com a credencial dela: o dinheiro cai direto na conta
 * da empresa, e o provedor não guarda nada entre chamadas.
 */

import type { Money, PaymentMethod } from './payment.types'
import type { PaymentProviderPort } from './providers'

/** Como a pessoa vai pagar esta cobrança. */
export const CHARGE_KIND = {
  /** Pix: QR code e copia-e-cola na hora. */
  PIX: 'pix',
  /** Link de pagamento do provedor (cartão de crédito/débito, e o que mais a conta aceitar). */
  PAYMENT_LINK: 'payment_link',
} as const
export type ChargeKind = (typeof CHARGE_KIND)[keyof typeof CHARGE_KIND]
export const CHARGE_KIND_VALUES = Object.values(CHARGE_KIND) as [ChargeKind, ...ChargeKind[]]

/** Estado da cobrança, na língua do trio. */
export const CHARGE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  /** Recusada, cancelada ou expirada sem pagar. */
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CHARGEBACK: 'chargeback',
} as const
export type ChargeStatus = (typeof CHARGE_STATUS)[keyof typeof CHARGE_STATUS]
export const CHARGE_STATUS_VALUES = Object.values(CHARGE_STATUS) as [ChargeStatus, ...ChargeStatus[]]

export type CreateChargeParams = {
  readonly kind: ChargeKind
  readonly amount: Money
  /** Id do pedido no host. Volta no webhook em `PaymentEvent.customerRef`. */
  readonly reference: string
  /** Texto curto que aparece no extrato/app do banco ("Pedido #123 - Restaurante X"). */
  readonly description: string
  /**
   * Chave de idempotência: a mesma chave não gera duas cobranças (o bot pode repetir a chamada).
   * Use algo estável, como `order-<id>-pix`.
   */
  readonly idempotencyKey: string
  /** Até quando a cobrança vale. Depois disso o provedor expira e o webhook avisa `payment_failed`. */
  readonly expiresAt: Date
  /** URL pública que o provedor chama quando o estado muda. */
  readonly notificationUrl?: string | undefined
  readonly payer?: { readonly email?: string | undefined; readonly name?: string | undefined } | undefined
}

export type Charge = {
  readonly provider: string
  /** Id da cobrança no provedor (pagamento no Pix, preferência no link). */
  readonly id: string
  readonly kind: ChargeKind
  readonly status: ChargeStatus
  readonly amount: Money
  readonly reference: string
  readonly expiresAt: Date | null
  /** Só no Pix. */
  readonly pix?: {
    /** O "copia e cola" (BR Code). */
    readonly copyPaste: string
    /** PNG do QR code em base64, sem o prefixo `data:`. */
    readonly qrCodeBase64: string | null
    /** Página do provedor com o QR, para quem abre no celular. */
    readonly ticketUrl: string | null
  }
  /** Só no link de pagamento. */
  readonly paymentUrl?: string | undefined
  readonly paymentMethod: PaymentMethod | null
}

export interface ChargeProviderPort {
  /** Tipos de cobrança que este provedor gera. */
  readonly chargeKinds: readonly ChargeKind[]
  createCharge(params: CreateChargeParams): Promise<Charge>
  /** Cancela uma cobrança Pix ainda pendente (o pedido foi cancelado antes de pagar). */
  cancelCharge?(params: { readonly id: string }): Promise<void>
}

export type ChargeCapablePaymentProvider = PaymentProviderPort & ChargeProviderPort

/** O provedor gera cobrança avulsa? Type guard para o host não precisar saber o nome. */
export function supportsCharges(provider: PaymentProviderPort): provider is ChargeCapablePaymentProvider {
  const candidate = provider as Partial<ChargeProviderPort>
  return typeof candidate.createCharge === 'function' && Array.isArray(candidate.chargeKinds)
}
