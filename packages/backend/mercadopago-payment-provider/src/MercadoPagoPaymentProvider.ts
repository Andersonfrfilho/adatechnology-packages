/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Plugin Mercado Pago do trio de pagamentos: cobrança avulsa por Pix (QR + copia-e-cola) e por link
 * de pagamento (cartão), e o webhook que diz quando caiu.
 *
 * - Uma instância por conta: o host cria o provedor com o access token de quem recebe (cada
 *   restaurante com o seu). O dinheiro cai direto na conta dona do token. Nada fica guardado aqui.
 * - Autenticidade: o Mercado Pago assina o webhook no cabeçalho `x-signature` (`ts=...,v1=...`), um
 *   HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com a "assinatura secreta" da
 *   aplicação (Suas integrações → Webhooks). Sem assinatura válida, o webhook é recusado.
 * - O webhook só traz o id do pagamento. O estado vem de `GET /v1/payments/:id` com o token da conta,
 *   então quem forja um corpo não consegue inventar um "aprovado".
 * - Idempotência: `eventId` é `<id do pagamento>:<status>`. O Mercado Pago avisa várias vezes o mesmo
 *   pagamento; só a mudança de estado conta como evento novo.
 * - Privacidade: só e-mail e nome saem daqui. CPF e telefone do pagador ficam no corpo cru.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  CHARGE_KIND,
  CHARGE_STATUS,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  PaymentConfigInvalidError,
  PaymentError,
  PAYMENT_ERROR_CODE,
  PaymentProviderCapabilityMissingError,
  PaymentWebhookInvalidError,
  PaymentWebhookUnauthorizedError,
} from '@adatechnology/payment-contracts'
import type {
  Charge,
  ChargeCapablePaymentProvider,
  ChargeStatus,
  CheckoutLinkParams,
  CreateChargeParams,
  IncomingWebhook,
  Money,
  PaymentEvent,
  PaymentEventType,
  PaymentMethod,
} from '@adatechnology/payment-contracts'

export const MERCADOPAGO_PROVIDER_NAME = 'mercadopago'
export const MERCADOPAGO_SIGNATURE_HEADER = 'x-signature'
export const MERCADOPAGO_REQUEST_ID_HEADER = 'x-request-id'
export const MERCADOPAGO_API_URL = 'https://api.mercadopago.com'

/** `status` do pagamento no Mercado Pago → evento do trio. */
export const MERCADOPAGO_EVENT_MAP: Readonly<Record<string, PaymentEventType>> = {
  approved: PAYMENT_EVENT_TYPE.PAYMENT_APPROVED,
  pending: PAYMENT_EVENT_TYPE.PAYMENT_PENDING,
  in_process: PAYMENT_EVENT_TYPE.PAYMENT_PENDING,
  authorized: PAYMENT_EVENT_TYPE.PAYMENT_PENDING,
  in_mediation: PAYMENT_EVENT_TYPE.PAYMENT_PENDING,
  rejected: PAYMENT_EVENT_TYPE.PAYMENT_FAILED,
  cancelled: PAYMENT_EVENT_TYPE.PAYMENT_FAILED,
  refunded: PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED,
  charged_back: PAYMENT_EVENT_TYPE.PAYMENT_CHARGEBACK,
}

/** `status` do pagamento no Mercado Pago → estado da cobrança. */
export const MERCADOPAGO_CHARGE_STATUS_MAP: Readonly<Record<string, ChargeStatus>> = {
  approved: CHARGE_STATUS.APPROVED,
  pending: CHARGE_STATUS.PENDING,
  in_process: CHARGE_STATUS.PENDING,
  authorized: CHARGE_STATUS.PENDING,
  in_mediation: CHARGE_STATUS.PENDING,
  rejected: CHARGE_STATUS.FAILED,
  cancelled: CHARGE_STATUS.FAILED,
  refunded: CHARGE_STATUS.REFUNDED,
  charged_back: CHARGE_STATUS.CHARGEBACK,
}

/** `payment_type_id` do Mercado Pago → método do trio. Pix vem como `bank_transfer`. */
export const MERCADOPAGO_PAYMENT_METHOD_MAP: Readonly<Record<string, PaymentMethod>> = {
  credit_card: PAYMENT_METHOD.CREDIT_CARD,
  debit_card: PAYMENT_METHOD.DEBIT_CARD,
  prepaid_card: PAYMENT_METHOD.DEBIT_CARD,
  bank_transfer: PAYMENT_METHOD.PIX,
  ticket: PAYMENT_METHOD.BOLETO,
  account_money: PAYMENT_METHOD.WALLET,
  digital_wallet: PAYMENT_METHOD.WALLET,
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type MercadoPagoProviderConfig = {
  /** Access token da conta que recebe (`APP_USR-...` em produção, `TEST-...` no sandbox). Vazio desliga. */
  readonly accessToken: string
  /** "Assinatura secreta" do webhook da aplicação. Vazio: o webhook é recusado. */
  readonly webhookSecret: string
  /**
   * O Mercado Pago exige e-mail do pagador no Pix. Quem paga pelo WhatsApp quase nunca tem: este
   * entra quando `payer.email` não vem (o e-mail do próprio estabelecimento, por exemplo).
   */
  readonly fallbackPayerEmail?: string | undefined
  /** Texto que aparece na fatura do cartão (até 22 caracteres). */
  readonly statementDescriptor?: string | undefined
  readonly apiUrl?: string | undefined
  /** Para teste: troca o `fetch` global. */
  readonly fetch?: FetchLike | undefined
}

type Json = Record<string, unknown>

function asObject(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined
}

function pick(source: unknown, path: string): unknown {
  let current: unknown = source
  for (const key of path.split('.')) {
    const object = asObject(current)
    if (!object) return undefined
    current = object[key]
  }
  return current
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function date(...values: unknown[]): Date | null {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return null
}

function header(headers: IncomingWebhook['headers'], name: string): string {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return found?.[1] ?? ''
}

function decode(rawBody: IncomingWebhook['rawBody']): string {
  return typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody)
}

/** `ts=1704908010,v1=abc...` → `{ ts, v1 }`. */
export function parseMercadoPagoSignature(value: string): { ts: string; v1: string } | null {
  const parts = new Map<string, string>()
  for (const piece of value.split(',')) {
    const [key, ...rest] = piece.split('=')
    if (key && rest.length > 0) parts.set(key.trim(), rest.join('=').trim())
  }
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  return ts && v1 ? { ts, v1 } : null
}

/**
 * O "manifest" que o Mercado Pago assina. Id alfanumérico vai em minúsculas (regra deles); parte sem
 * valor fica de fora.
 */
export function buildMercadoPagoManifest(params: { dataId: string | null; requestId: string; ts: string }): string {
  const dataId = params.dataId && /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId
  let manifest = ''
  if (dataId) manifest += `id:${dataId};`
  if (params.requestId) manifest += `request-id:${params.requestId};`
  manifest += `ts:${params.ts};`
  return manifest
}

/** Assina como o Mercado Pago. Exportado para o host montar webhooks de teste. */
export function signMercadoPagoWebhook(params: {
  secret: string
  dataId: string | null
  requestId: string
  ts: string
}): string {
  const manifest = buildMercadoPagoManifest(params)
  const v1 = createHmac('sha256', params.secret).update(manifest).digest('hex')
  return `ts=${params.ts},v1=${v1}`
}

function sameHex(received: string, expected: string): boolean {
  const left = Buffer.from(received.toLowerCase())
  const right = Buffer.from(expected.toLowerCase())
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Data no formato que a API aceita (`yyyy-MM-ddTHH:mm:ss.SSS+00:00`). */
function apiDate(value: Date): string {
  return value.toISOString().replace('Z', '+00:00')
}

function toAmount(cents: number): number {
  return Math.round(cents) / 100
}

function money(value: unknown, currency: unknown): Money | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return { cents: Math.round(value * 100), currency: (text(currency) ?? 'BRL').toUpperCase() }
}

function paymentMethodOf(payment: unknown): PaymentMethod | null {
  if (text(pick(payment, 'payment_method_id')) === 'pix') return PAYMENT_METHOD.PIX
  const type = text(pick(payment, 'payment_type_id'))
  if (!type) return null
  return MERCADOPAGO_PAYMENT_METHOD_MAP[type] ?? PAYMENT_METHOD.OTHER
}

/** Erro da API do Mercado Pago (credencial errada, valor inválido...). */
export class MercadoPagoApiError extends PaymentError {
  constructor(
    readonly httpStatus: number,
    readonly providerMessage: string,
  ) {
    super(
      `Mercado Pago recusou a chamada (${httpStatus}): ${providerMessage}`,
      httpStatus === 401 || httpStatus === 403
        ? PAYMENT_ERROR_CODE.PROVIDER_NOT_CONFIGURED
        : PAYMENT_ERROR_CODE.CONFIG_INVALID,
      { provider: MERCADOPAGO_PROVIDER_NAME, httpStatus },
    )
  }
}

export function createMercadoPagoPaymentProvider(config: MercadoPagoProviderConfig): ChargeCapablePaymentProvider {
  const accessToken = config.accessToken.trim()
  const webhookSecret = config.webhookSecret.trim()
  const apiUrl = (config.apiUrl ?? MERCADOPAGO_API_URL).replace(/\/$/, '')
  const doFetch: FetchLike = config.fetch ?? ((input, init) => fetch(input, init))

  async function call(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<Json> {
    if (accessToken.length === 0) {
      throw new PaymentConfigInvalidError('Mercado Pago sem access token')
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey
    const response = await doFetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const raw = await response.text()
    let parsed: unknown = undefined
    try {
      parsed = raw.length > 0 ? JSON.parse(raw) : {}
    } catch {
      parsed = undefined
    }
    if (!response.ok) {
      throw new MercadoPagoApiError(
        response.status,
        text(pick(parsed, 'message'), pick(parsed, 'error')) ?? raw.slice(0, 200),
      )
    }
    return asObject(parsed) ?? {}
  }

  async function createPixCharge(params: CreateChargeParams): Promise<Charge> {
    const email = params.payer?.email ?? config.fallbackPayerEmail
    if (!email) {
      throw new PaymentConfigInvalidError('o Pix do Mercado Pago exige e-mail do pagador (use fallbackPayerEmail)')
    }
    const payment = await call(
      'POST',
      '/v1/payments',
      {
        transaction_amount: toAmount(params.amount.cents),
        description: params.description,
        payment_method_id: 'pix',
        external_reference: params.reference,
        date_of_expiration: apiDate(params.expiresAt),
        ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
        payer: { email, ...(params.payer?.name ? { first_name: params.payer.name } : {}) },
      },
      params.idempotencyKey,
    )
    const id = text(payment['id'])
    const copyPaste = text(pick(payment, 'point_of_interaction.transaction_data.qr_code'))
    if (!id || !copyPaste) {
      throw new MercadoPagoApiError(502, 'resposta sem id ou sem qr_code do Pix')
    }
    return {
      provider: MERCADOPAGO_PROVIDER_NAME,
      id,
      kind: CHARGE_KIND.PIX,
      status: MERCADOPAGO_CHARGE_STATUS_MAP[text(payment['status']) ?? ''] ?? CHARGE_STATUS.PENDING,
      amount: params.amount,
      reference: params.reference,
      expiresAt: date(payment['date_of_expiration']) ?? params.expiresAt,
      pix: {
        copyPaste,
        qrCodeBase64: text(pick(payment, 'point_of_interaction.transaction_data.qr_code_base64')),
        ticketUrl: text(pick(payment, 'point_of_interaction.transaction_data.ticket_url')),
      },
      paymentMethod: PAYMENT_METHOD.PIX,
    }
  }

  async function createPaymentLink(params: CreateChargeParams): Promise<Charge> {
    const preference = await call(
      'POST',
      '/checkout/preferences',
      {
        items: [
          {
            id: params.reference,
            title: params.description,
            quantity: 1,
            unit_price: toAmount(params.amount.cents),
            currency_id: params.amount.currency,
          },
        ],
        external_reference: params.reference,
        ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
        ...(params.payer?.email ? { payer: { email: params.payer.email } } : {}),
        ...(config.statementDescriptor ? { statement_descriptor: config.statementDescriptor.slice(0, 22) } : {}),
        expires: true,
        expiration_date_to: apiDate(params.expiresAt),
        // Pedido de comida: boleto não cai a tempo. Cartão à vista.
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 1 },
        binary_mode: true,
      },
      params.idempotencyKey,
    )
    const id = text(preference['id'])
    const paymentUrl = text(preference['init_point'])
    if (!id || !paymentUrl) {
      throw new MercadoPagoApiError(502, 'resposta sem id ou sem init_point')
    }
    return {
      provider: MERCADOPAGO_PROVIDER_NAME,
      id,
      kind: CHARGE_KIND.PAYMENT_LINK,
      status: CHARGE_STATUS.PENDING,
      amount: params.amount,
      reference: params.reference,
      expiresAt: date(preference['expiration_date_to']) ?? params.expiresAt,
      paymentUrl,
      paymentMethod: null,
    }
  }

  function verifySignature(headers: IncomingWebhook['headers'], dataId: string | null): void {
    const signature = parseMercadoPagoSignature(header(headers, MERCADOPAGO_SIGNATURE_HEADER))
    if (webhookSecret.length === 0 || !signature) {
      throw new PaymentWebhookUnauthorizedError(MERCADOPAGO_PROVIDER_NAME)
    }
    const manifest = buildMercadoPagoManifest({
      dataId,
      requestId: header(headers, MERCADOPAGO_REQUEST_ID_HEADER),
      ts: signature.ts,
    })
    const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex')
    if (!sameHex(signature.v1, expected)) {
      throw new PaymentWebhookUnauthorizedError(MERCADOPAGO_PROVIDER_NAME)
    }
  }

  return {
    name: MERCADOPAGO_PROVIDER_NAME,
    paymentMethods: [PAYMENT_METHOD.PIX, PAYMENT_METHOD.CREDIT_CARD, PAYMENT_METHOD.DEBIT_CARD, PAYMENT_METHOD.WALLET],
    chargeKinds: [CHARGE_KIND.PIX, CHARGE_KIND.PAYMENT_LINK],
    isConfigured: () => accessToken.length > 0 && webhookSecret.length > 0,

    async createCharge(params: CreateChargeParams): Promise<Charge> {
      if (!Number.isInteger(params.amount.cents) || params.amount.cents <= 0) {
        throw new PaymentConfigInvalidError('valor da cobrança precisa ser inteiro em centavos e maior que zero')
      }
      if (params.kind === CHARGE_KIND.PIX) return createPixCharge(params)
      if (params.kind === CHARGE_KIND.PAYMENT_LINK) return createPaymentLink(params)
      throw new PaymentProviderCapabilityMissingError(MERCADOPAGO_PROVIDER_NAME, `cobrança ${String(params.kind)}`)
    },

    async cancelCharge({ id }): Promise<void> {
      await call('PUT', `/v1/payments/${encodeURIComponent(id)}`, { status: 'cancelled' })
    },

    async parseWebhook({ headers, rawBody }): Promise<PaymentEvent> {
      let payload: unknown
      try {
        payload = JSON.parse(decode(rawBody))
      } catch {
        throw new PaymentWebhookInvalidError(MERCADOPAGO_PROVIDER_NAME, 'corpo não é JSON')
      }
      const dataId = text(pick(payload, 'data.id'))
      verifySignature(headers, dataId)

      const topic = text(pick(payload, 'type'), pick(payload, 'topic'))
      const action = text(pick(payload, 'action')) ?? topic ?? 'unknown'
      const ignored = (reason: string): PaymentEvent => ({
        provider: MERCADOPAGO_PROVIDER_NAME,
        eventId: `${topic ?? 'unknown'}:${dataId ?? text(pick(payload, 'id')) ?? 'none'}:${reason}`,
        type: PAYMENT_EVENT_TYPE.IGNORED,
        providerEventType: action,
        occurredAt: date(pick(payload, 'date_created')) ?? new Date(),
        subscriptionId: null,
        transactionId: dataId,
        customer: { email: null, name: null },
        customerRef: null,
        offerCode: null,
        planName: null,
        paymentMethod: null,
        amount: null,
        periodEndsAt: null,
      })

      if (topic !== 'payment' || !dataId) return ignored('topic')

      // O corpo não é a fonte da verdade: o estado vem da API, com o token da conta.
      let payment: Json
      try {
        payment = await call('GET', `/v1/payments/${encodeURIComponent(dataId)}`)
      } catch (error) {
        // Notificação de teste do painel ("simular") manda um id que não existe na conta.
        if (error instanceof MercadoPagoApiError && error.httpStatus === 404) return ignored('not_found')
        throw error
      }
      const status = text(payment['status']) ?? 'unknown'
      const paymentId = text(payment['id']) ?? dataId
      return {
        provider: MERCADOPAGO_PROVIDER_NAME,
        eventId: `${paymentId}:${status}`,
        type: MERCADOPAGO_EVENT_MAP[status] ?? PAYMENT_EVENT_TYPE.IGNORED,
        providerEventType: `payment.${status}`,
        occurredAt: date(payment['date_last_updated'], payment['date_approved'], payment['date_created']) ?? new Date(),
        // Compra avulsa: o trio trata a transação como uma "assinatura" que não vence.
        subscriptionId: paymentId,
        transactionId: paymentId,
        customer: {
          email: text(pick(payment, 'payer.email'))?.toLowerCase() ?? null,
          name: text(pick(payment, 'payer.first_name')),
        },
        customerRef: text(payment['external_reference']),
        offerCode: null,
        planName: null,
        paymentMethod: paymentMethodOf(payment),
        amount: money(payment['transaction_amount'], payment['currency_id']),
        periodEndsAt: null,
      }
    },

    buildCheckoutUrl({ checkoutUrl, customerRef }: CheckoutLinkParams): string {
      // Assinatura não é o caso de uso aqui: link avulso vem de `createCharge`. Marca a referência
      // para manter o contrato.
      const url = new URL(checkoutUrl)
      url.searchParams.set('external_reference', customerRef)
      return url.toString()
    },
  }
}
