import { createHash, timingSafeEqual } from 'node:crypto'
import {
  MarketplaceApiError,
  type MarketplaceAction,
  type MarketplaceBenefit,
  type MarketplaceCancellationReason,
  type MarketplaceDateRange,
  type MarketplaceDispute,
  type MarketplaceDisputeResponse,
  type MarketplaceEvent,
  type MarketplaceEventKind,
  type MarketplaceFinancialEntry,
  type MarketplaceFinancialProvider,
  type MarketplaceOrder,
  type MarketplaceOrderContext,
  type MarketplaceProvider,
  type MarketplaceSale,
  type MarketplaceSettlement,
} from '@adatechnology/marketplace-contracts'
import {
  TokenCache,
  compactDate,
  parseJsonKeepingBigInts,
  roundMoney,
  withRetry,
  type FetchFunction,
} from '@adatechnology/marketplace-contracts'

/**
 * 99Food no protocolo próprio (o recomendado por ela; Open Delivery fica como alternativa). Pedidos
 * chegam por webhook (sem polling), o token é por loja (`app_shop_id`), os ids são inteiros de 64 bits
 * e todo valor vem em centavos. Regras no README do pacote.
 */

export interface Food99Config {
  appId: string
  appSecret: string
  /** `app_shop_id` de cada loja: o id que o restaurante usa para a loja ao vincular no portal da 99Food. */
  shopIds: string[]
  baseUrl?: string | undefined
}

const DEFAULT_BASE_URL = 'https://openapi.99food.com'
const TOKEN_EXPIRED = 10102
const CANCEL_APPLY_WINDOW_MS = 5 * 60_000

const WEBHOOK_KINDS: Record<string, MarketplaceEventKind> = {
  orderNew: 'placed',
  orderConfirm: 'confirmed',
  orderConfirmed: 'confirmed',
  orderCancel: 'cancelled',
  orderFinish: 'concluded',
  orderPartialCancel: 'order_patched',
  orderCancelApply: 'dispute_opened',
  orderRefundApply: 'dispute_opened',
}

const PAY_CHANNEL_LABELS: Record<number, string> = {
  110: 'Cupom',
  120: 'Carteira 99Food',
  150: 'Cartão',
  153: 'Dinheiro',
  154: 'Maquininha',
  167: 'Cartão (pré-autorização)',
  190: '99Pay',
  212: 'Pix',
  229: 'NuPay',
  234: 'Apple Pay',
  235: 'Apple Pay',
  257: 'Pluxee',
  258: 'Ticket',
  259: 'VR',
  260: 'Alelo',
  262: 'Maquininha crédito',
  263: 'Maquininha débito',
  264: 'Maquininha vale-refeição',
  266: 'Edenred',
  272: 'Google Pay',
  280: 'Pix',
  901: 'Benefício',
  2008: 'Marketing',
}

/** Motivos de cancelamento da 99Food (`reason_id`). Os marcados só valem para entrega própria. */
const CANCELLATION_REASONS: Array<MarketplaceCancellationReason & { selfDeliveryOnly?: boolean }> = [
  { code: '1010', description: 'Item esgotado' },
  { code: '1020', description: 'Loja fechada hoje' },
  { code: '1030', description: 'Loja sem condições de preparar agora' },
  { code: '1040', description: 'Acidente ou falta de luz/água' },
  { code: '1050', description: 'Problema com o cliente' },
  { code: '1060', description: 'Sem entregador', selfDeliveryOnly: true },
  { code: '1070', description: 'Cardápio precisa ser atualizado' },
  { code: '1071', description: 'Fora da área de entrega', selfDeliveryOnly: true },
  { code: '1072', description: 'Endereço em área de risco', selfDeliveryOnly: true },
  { code: '1073', description: 'Suspeita de fraude ou trote' },
  { code: '1074', description: 'Dúvida sobre taxas ou promoções' },
  { code: '1080', description: 'Outro motivo (descrever)' },
]

const REASON_KEYWORDS: Array<[RegExp, string]> = [
  [/falt|acab|indispon|estoque|esgot/i, '1010'],
  [/fechad|hor[aá]rio/i, '1020'],
  [/movimento|cheio|demora|ocupad/i, '1030'],
  [/entregador|motoboy/i, '1060'],
  [/endere|[aá]rea|longe/i, '1071'],
  [/trote|golp|fraude/i, '1073'],
  [/card[aá]pio|pre[cç]o/i, '1070'],
]

export function food99CancellationCode(reason: string): string {
  return REASON_KEYWORDS.find(([pattern]) => pattern.test(reason))?.[1] ?? '1080'
}

const BILL_TYPES: Record<number, string> = {
  1: 'Venda',
  2: 'Estorno (pedido cancelado)',
  3: 'Estorno parcial',
  4: 'Estorno pós-venda',
  5: 'Despesa sem pedido',
}

interface Food99Envelope<T> {
  errno: number
  errmsg?: string
  requestId?: string
  data?: T
}

interface Food99Item {
  app_item_id?: string
  name: string
  sku_price?: number
  total_price?: number
  amount?: number
  remark?: string | string[]
  sub_item_list?: Food99Item[]
}

export interface Food99OrderInfo {
  order_id: string | number
  order_index?: number
  status?: number
  remark?: string
  pay_method?: number
  pay_channel?: number
  change_for?: number
  delivery_type?: number
  fulfillment_mode?: number
  pickup_code?: string
  handover_code?: string
  takeaway_code?: string
  need_cutlery?: boolean
  create_time?: number
  price?: Record<string, number | undefined>
  shop?: { app_shop_id?: string; shop_name?: string }
  receive_address?: {
    name?: string
    first_name?: string
    last_name?: string
    cpf?: string | number
    calling_code?: string
    phone?: string
    virtual_phone_number?: string
    locator?: string
    formatted_address?: string
    street_name?: string
    street_number?: string
    district?: string
    city?: string
    complement?: string
    reference?: string
  } | null
  order_items?: Food99Item[]
  promotions?: Array<{ promo_type?: number; promo_discount?: number; shop_subside_price?: number }>
}

interface Food99Webhook {
  app_id?: string | number
  app_shop_id?: string
  type?: string
  timestamp?: number
  data?: Record<string, unknown> | string
}

export class Food99MarketplaceProvider implements MarketplaceProvider {
  readonly platform = '99food' as const
  readonly financial: MarketplaceFinancialProvider
  private readonly baseUrl: string
  private readonly shopTokens = new Map<string, TokenCache>()
  private readonly financeToken: TokenCache

  constructor(
    private readonly config: Food99Config,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.financeToken = new TokenCache(() => this.requestFinanceToken())
    this.financial = new Food99Financial(this)
  }

  // ------------------------------------------------------------ token por loja

  private tokenFor(shopId: string): TokenCache {
    let cache = this.shopTokens.get(shopId)
    if (!cache) {
      cache = new TokenCache(() => this.requestShopToken(shopId), 300)
      this.shopTokens.set(shopId, cache)
    }
    return cache
  }

  private authQuery(shopId: string): URLSearchParams {
    return new URLSearchParams({ app_id: this.config.appId, app_secret: this.config.appSecret, app_shop_id: shopId })
  }

  private async requestShopToken(shopId: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
    let data = await this.callPublic<{ auth_token: string; token_expiration_time: number }>(
      `/v1/auth/authtoken/get?${this.authQuery(shopId)}`,
      'token',
    )
    // Token vencido: a 99Food pede para renovar e buscar de novo.
    if (data.token_expiration_time * 1000 <= Date.now()) {
      await this.callPublic(`/v1/auth/authtoken/refresh?${this.authQuery(shopId)}`, 'renovar token')
      data = await this.callPublic(`/v1/auth/authtoken/get?${this.authQuery(shopId)}`, 'token')
    }
    return {
      accessToken: data.auth_token,
      expiresInSeconds: Math.max(data.token_expiration_time - Math.floor(Date.now() / 1000), 60),
    }
  }

  private async callPublic<T>(path: string, operation: string): Promise<T> {
    const response = await this.fetchFunction(`${this.baseUrl}${path}`)
    return this.unwrap<T>(response, operation)
  }

  private async unwrap<T>(response: Response, operation: string): Promise<T> {
    const text = await response.text()
    if (!response.ok) throw new MarketplaceApiError(this.platform, operation, response.status, text)
    const envelope = parseJsonKeepingBigInts<Food99Envelope<T>>(text)
    if (envelope.errno !== 0) {
      throw new Food99ApiError(
        operation,
        envelope.errno,
        `${envelope.errmsg ?? ''} (requestId ${envelope.requestId ?? '-'})`,
      )
    }
    return envelope.data as T
  }

  /** Loja do pedido: a informada ou, com uma loja só, ela. */
  shopFor(context?: MarketplaceOrderContext): string {
    const shop = context?.merchantId ?? (this.config.shopIds.length === 1 ? this.config.shopIds[0] : undefined)
    if (!shop) throw new Error('[99Food] loja do pedido desconhecida')
    return shop
  }

  /** Chamada com o `auth_token` da loja; token vencido (10102) renova e repete uma vez. */
  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    shopId: string,
    params: Record<string, unknown>,
    operation: string,
  ): Promise<T> {
    const send = async (): Promise<T> => {
      const token = await this.tokenFor(shopId).get()
      const response = await withRetry(() =>
        method === 'GET'
          ? this.fetchFunction(
              `${this.baseUrl}${path}?${new URLSearchParams({ auth_token: token, ...stringify(params) })}`,
            )
          : this.fetchFunction(`${this.baseUrl}${path}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: jsonWithBigInts({ auth_token: token, ...params }),
            }),
      )
      return this.unwrap<T>(response, operation)
    }
    try {
      return await send()
    } catch (error) {
      if (!(error instanceof Food99ApiError) || error.errno !== TOKEN_EXPIRED) throw error
      this.tokenFor(shopId).invalidate()
      return send()
    }
  }

  // ------------------------------------------------------------ pedidos

  /** A 99Food só manda pedidos por webhook. */
  async pollEvents(): Promise<MarketplaceEvent[]> {
    return []
  }

  async acknowledge(): Promise<void> {
    // Webhook respondido com errno 0 já é a confirmação.
  }

  async getOrder(externalId: string, context?: MarketplaceOrderContext): Promise<MarketplaceOrder> {
    const data = await this.call<{ order_info?: Food99OrderInfo } & Partial<Food99OrderInfo>>(
      'GET',
      '/v1/order/order/detail',
      this.shopFor(context),
      { order_id: externalId },
      'pedido',
    )
    const info = data.order_info ?? (data as Food99OrderInfo)
    return mapFood99Order(info, context?.merchantId ?? this.shopFor(context))
  }

  async sendAction(externalId: string, action: MarketplaceAction, context?: MarketplaceOrderContext): Promise<void> {
    const shopId = this.shopFor(context)
    const orderId = { order_id: externalId }
    switch (action) {
      case 'confirm':
        await this.call('POST', '/v1/order/order/confirm', shopId, orderId, 'confirmar')
        return
      case 'readyForPickup':
        await this.call('POST', '/v1/order/order/ready', shopId, orderId, 'pronto')
        return
      case 'dispatch': {
        const courier = context?.courier
        const [firstName, ...rest] = (courier?.name?.trim() || 'Entregador da loja').split(/\s+/)
        const now = Math.floor(Date.now() / 1000)
        await this.call(
          'POST',
          '/v1/order/selfdelivery/dispatch',
          shopId,
          {
            ...orderId,
            courier_info: {
              courier_name: courier?.name?.trim() || 'Entregador da loja',
              courier_first_name: firstName,
              courier_last_name: rest.join(' ') || 'Loja',
              courier_phone_code: '+55',
              courier_phone: (courier?.phone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''),
            },
            limit_time: { pickup_time: now, delivery_time: now + 40 * 60 },
          },
          'saiu para entrega',
        )
        return
      }
      case 'delivered':
        await this.call('POST', '/v1/order/selfdelivery/delivered', shopId, orderId, 'entregue')
        return
      case 'pickedUp':
        await this.call('POST', '/v1/order/order/finish', shopId, orderId, 'retirado')
        return
      default:
        // Sem "em preparo" na 99Food: o aceite já marca o início.
        return
    }
  }

  async cancellationReasons(
    _externalId: string,
    context?: MarketplaceOrderContext,
  ): Promise<MarketplaceCancellationReason[]> {
    const selfDelivery = context?.deliveredBy === 'merchant' && context?.type !== 'pickup'
    return CANCELLATION_REASONS.filter((reason) => selfDelivery || !reason.selfDeliveryOnly).map(
      ({ code, description }) => ({ code, description }),
    )
  }

  async requestCancellation(
    externalId: string,
    cancellation: { code?: string | undefined; reason: string },
    context?: MarketplaceOrderContext,
  ): Promise<void> {
    const code = cancellation.code ?? food99CancellationCode(cancellation.reason)
    await this.call(
      'POST',
      '/v1/order/order/cancel',
      this.shopFor(context),
      { order_id: externalId, reason_id: Number(code), reason: cancellation.reason.slice(0, 250) },
      'cancelar',
    )
  }

  // ------------------------------------------------------------ pedidos de cancelamento e reembolso

  parseDispute(event: MarketplaceEvent): MarketplaceDispute | null {
    const data = event.metadata ?? {}
    const applyId = data['apply_id']
    if (applyId === undefined || applyId === null) return null
    const refund = event.code === 'orderRefundApply'
    const reasonList = (refund ? data['base_reason_list'] : data['reason_list']) as
      Array<Record<string, unknown>> | undefined
    const createdAt = event.createdAt ? Date.parse(event.createdAt) : Date.now()
    return {
      externalId: `${refund ? 'refund' : 'cancel'}:${String(applyId)}`,
      orderExternalId: event.orderId,
      kind: refund ? 'refund' : 'cancellation',
      message: typeof data['apply_reason'] === 'string' ? data['apply_reason'] : undefined,
      // Cancelamento: 5 min para responder, depois a 99Food recusa sozinha. Reembolso: aceita sozinha depois de 25 h.
      expiresAt: refund
        ? new Date(createdAt + 25 * 3_600_000).toISOString()
        : new Date(createdAt + CANCEL_APPLY_WINDOW_MS).toISOString(),
      timeoutAction: refund
        ? 'Sem resposta, a 99Food aprova o reembolso'
        : 'Sem resposta, a 99Food recusa o cancelamento',
      alternatives: [],
      reasons: (reasonList ?? []).map((entry) => String(entry['reason'] ?? entry['base_reason'] ?? '')).filter(Boolean),
      evidenceUrls: Array.isArray(data['images'])
        ? (data['images'] as unknown[]).filter((url): url is string => typeof url === 'string')
        : undefined,
    }
  }

  parseDisputeSettlement(): null {
    return null
  }

  async respondDispute(
    dispute: MarketplaceDispute,
    answer: MarketplaceDisputeResponse,
    context?: MarketplaceOrderContext,
  ): Promise<void> {
    if (answer.decision === 'alternative') throw new Error('A 99Food não aceita contraproposta: aceite ou recuse')
    const [kind, applyId] = dispute.externalId.split(':')
    await this.call(
      'POST',
      kind === 'refund' ? '/v1/order/apply/refund' : '/v1/order/apply/cancel',
      this.shopFor(context),
      {
        order_id: dispute.orderExternalId,
        apply_id: applyId,
        agree: answer.decision === 'accept',
        ...(answer.reason ? { reason: answer.reason } : {}),
      },
      kind === 'refund' ? 'responder reembolso' : 'responder cancelamento',
    )
  }

  // ------------------------------------------------------------ webhook

  /** `didi-header-sign` = MD5 (hex) do corpo cru seguido do app_secret. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): boolean {
    const received = headers['didi-header-sign']
    if (!received) return false
    const expected = createHash('md5')
      .update(Buffer.concat([rawBody, Buffer.from(this.config.appSecret)]))
      .digest('hex')
    const receivedBuffer = Buffer.from(received.trim().toLowerCase())
    const expectedBuffer = Buffer.from(expected)
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
  }

  parseWebhook(rawBody: Buffer): MarketplaceEvent[] {
    let body: Food99Webhook
    try {
      body = parseJsonKeepingBigInts<Food99Webhook>(rawBody.toString('utf8'))
    } catch {
      return []
    }
    const type = body.type ?? ''
    const data = (typeof body.data === 'string' ? safeParse(body.data) : body.data) ?? {}
    const orderId = data['order_id'] !== undefined ? String(data['order_id']) : ''
    if (!type || !orderId) return []
    const applyId = data['apply_id'] !== undefined ? String(data['apply_id']) : undefined
    // Sem id de evento na 99Food: o id nasce do tipo + pedido (+ pedido de cancelamento ou horário).
    const kind = WEBHOOK_KINDS[type] ?? 'other'
    const oncePerOrder = kind === 'placed' || kind === 'confirmed' || kind === 'cancelled' || kind === 'concluded'
    const uniquePart = applyId ?? (oncePerOrder ? '' : String(body.timestamp ?? ''))
    return [
      {
        id: [type, orderId, uniquePart].filter(Boolean).join(':'),
        code: type,
        kind,
        orderId,
        merchantId: body.app_shop_id,
        createdAt: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : undefined,
        metadata: data,
      },
    ]
  }

  /** A 99Food repete o webhook até receber `{ errno: 0 }`. */
  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: 200, body: ok ? { errno: 0, errmsg: 'ok' } : { errno: 1, errmsg: 'retry' } }
  }

  // ------------------------------------------------------------ financeiro

  private async requestFinanceToken(): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const response = await this.fetchFunction(`${this.baseUrl}/v3/auth/authtoken/signIn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retailer: this.config.appId, secret: this.config.appSecret }),
    })
    const text = await response.text()
    if (!response.ok) throw new MarketplaceApiError(this.platform, 'token financeiro', response.status, text)
    const parsed = JSON.parse(text) as {
      accessToken?: string
      expiresIn?: number
      data?: { accessToken?: string; expiresIn?: number }
      errno?: number
      errmsg?: string
    }
    const token = parsed.accessToken ?? parsed.data?.accessToken
    if (!token) throw new Food99ApiError('token financeiro', parsed.errno ?? -1, parsed.errmsg ?? 'sem accessToken')
    return { accessToken: token, expiresInSeconds: parsed.expiresIn ?? parsed.data?.expiresIn ?? 3600 }
  }

  async financeCall<T>(path: string, body: Record<string, unknown>, operation: string): Promise<T> {
    const send = async (): Promise<Response> =>
      withRetry(async () =>
        this.fetchFunction(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.financeToken.get()}` },
          body: JSON.stringify(body),
        }),
      )
    let response = await send()
    if (response.status === 401) {
      this.financeToken.invalidate()
      response = await send()
    }
    return this.unwrap<T>(response, operation)
  }
}

export class Food99ApiError extends MarketplaceApiError {
  constructor(
    operation: string,
    readonly errno: number,
    message: string,
  ) {
    super('99food', operation, 200, `errno ${errno}: ${message}`)
    this.name = 'Food99ApiError'
  }
}

// ---------------------------------------------------------------- financeiro

interface Food99BillPage<T> {
  data?: T[]
  total_page?: number
  total_num?: number
}

interface Food99Bill {
  orderId?: string | number
  orderIndex?: string | number
  orderType?: number
  businessDateTime?: string
  mealOriginalAmount?: number
  shopDeliveryAmount?: number
  shopActivityOutcome?: number
  shopActivitySubsidy?: number
  freeDeliveryOutcome?: number
  freeDeliverySubsidy?: number
  commissionAmount?: number
  commissionSubsidyAmount?: number
  b2pDeliveryAmount?: number
  payCommissionAmount?: number
  mealLossDeductAmount?: number
  merchantAppealAmount?: number
  paymentChannel?: number
  cardBrand?: string
  settlementAmount?: number
  expectSettleDate?: string
}

interface Food99WeekPayment {
  weekPaymentId?: string | number
  withdrawDate?: string
  withdrawAmount?: number
  settleStartDate?: string
  settleEndDate?: string
}

const BILL_ENTRIES: Array<[keyof Food99Bill, string, 1 | -1]> = [
  ['commissionAmount', 'Comissão', -1],
  ['commissionSubsidyAmount', 'Subsídio da comissão', 1],
  ['payCommissionAmount', 'Taxa de pagamento', -1],
  ['b2pDeliveryAmount', 'Entrega da 99Food', -1],
  ['shopActivityOutcome', 'Desconto pago pela loja', -1],
  ['shopActivitySubsidy', 'Desconto pago pela 99Food', 1],
  ['freeDeliveryOutcome', 'Frete grátis pago pela loja', -1],
  ['freeDeliverySubsidy', 'Frete grátis pago pela 99Food', 1],
  ['mealLossDeductAmount', 'Desconto por cancelamento', -1],
  ['merchantAppealAmount', 'Contestação aprovada', 1],
]

class Food99Financial implements MarketplaceFinancialProvider {
  /** A 99Food aceita até 31 dias por consulta e só os últimos 3 meses. */
  readonly maxRangeDays = 31

  constructor(private readonly api: Food99MarketplaceProvider) {}

  private async pages<T>(path: string, shopId: string, range: MarketplaceDateRange, operation: string): Promise<T[]> {
    const rows: T[] = []
    for (let page = 1; page <= 50; page += 1) {
      const data = await this.api.financeCall<Food99BillPage<T>>(
        path,
        {
          acceptor_code: shopId,
          page_no: page,
          page_size: 200,
          start_date: compactDate(range.from),
          end_date: compactDate(range.to),
        },
        operation,
      )
      rows.push(...(data.data ?? []))
      if (!data.total_page || page >= data.total_page) break
    }
    return rows
  }

  async listSales(shopId: string, range: MarketplaceDateRange): Promise<MarketplaceSale[]> {
    const bills = await this.pages<Food99Bill>('/v3/finance/finance/getShopBillDetail', shopId, range, 'vendas')
    return bills.map((bill) => mapFood99Bill(shopId, bill))
  }

  async listSettlements(shopId: string, range: MarketplaceDateRange): Promise<MarketplaceSettlement[]> {
    const weeks = await this.pages<Food99WeekPayment>('/v3/finance/finance/getShopBillWeek', shopId, range, 'repasses')
    const today = new Date().toISOString().slice(0, 10)
    return weeks.map((week, index) => ({
      platform: '99food' as const,
      merchantId: shopId,
      id: String(week.weekPaymentId ?? index),
      periodStart: isoDate(week.settleStartDate),
      periodEnd: isoDate(week.settleEndDate),
      paymentDate: week.withdrawDate,
      amount: cents(week.withdrawAmount),
      status: week.withdrawDate && week.withdrawDate <= today ? 'Pago' : 'Previsto',
      type: 'Repasse semanal',
    }))
  }
}

export function mapFood99Bill(shopId: string, bill: Food99Bill): MarketplaceSale {
  const entries: MarketplaceFinancialEntry[] = BILL_ENTRIES.filter(([field]) => Number(bill[field] ?? 0) !== 0).map(
    ([field, label, sign]) => ({
      label,
      amount: roundMoney(sign * Math.abs(cents(bill[field] as number))),
    }),
  )
  return {
    platform: '99food',
    merchantId: shopId,
    externalOrderId: bill.orderId !== undefined ? String(bill.orderId) : '',
    displayId: bill.orderIndex !== undefined ? String(bill.orderIndex) : undefined,
    date: bill.businessDateTime ?? '',
    status: BILL_TYPES[bill.orderType ?? 0] ?? `Lançamento ${bill.orderType ?? ''}`.trim(),
    paymentMethod:
      [PAY_CHANNEL_LABELS[bill.paymentChannel ?? 0], bill.cardBrand].filter(Boolean).join(' ') || undefined,
    grossAmount: roundMoney(cents(bill.mealOriginalAmount) + cents(bill.shopDeliveryAmount)),
    entries,
    netAmount: cents(bill.settlementAmount),
    expectedTransferDate: bill.expectSettleDate,
  }
}

// ---------------------------------------------------------------- tradução do pedido

/** Valores da 99Food vêm na menor unidade (centavos). */
function cents(value: number | string | undefined | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? roundMoney(parsed / 100) : 0
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value
}

function remarkText(remark: string | string[] | undefined): string | undefined {
  if (Array.isArray(remark)) return remark.filter(Boolean).join(', ') || undefined
  return remark || undefined
}

function customerName(address: NonNullable<Food99OrderInfo['receive_address']>): string {
  const hidden = (value: string | undefined) => !value || /privacy protection/i.test(value)
  if (!hidden(address.name)) return address.name!.trim()
  const parts = [address.first_name, address.last_name].filter((part) => !hidden(part))
  return parts.join(' ').trim() || 'Cliente 99Food'
}

export function mapFood99Order(info: Food99OrderInfo, shopId?: string): MarketplaceOrder {
  const price = info.price ?? {}
  const pickup = info.fulfillment_mode === 1 || info.delivery_type === 0
  const merchantDelivers = info.delivery_type === 2
  const address = info.receive_address ?? undefined
  const deliveryFee = merchantDelivers ? cents(price['delivery_price']) : 0
  const itemsDiscount = cents(price['items_discount'])
  const orderAmount =
    cents(price['real_pay_price'] ?? price['customer_need_paying_money']) ||
    roundMoney(cents(price['order_price']) - itemsDiscount + deliveryFee)
  const online = info.pay_method === 1

  const formatted =
    address?.formatted_address ||
    [[address?.street_name, address?.street_number].filter(Boolean).join(', '), address?.district, address?.city]
      .filter(Boolean)
      .join(' - ')

  const benefits: MarketplaceBenefit[] = (info.promotions ?? [])
    .filter((promotion) => (promotion.promo_discount ?? 0) > 0)
    .map((promotion) => {
      const total = cents(promotion.promo_discount)
      const store = cents(promotion.shop_subside_price)
      return {
        amount: total,
        sponsors: [
          ...(store > 0 ? [{ name: 'loja', amount: store }] : []),
          ...(total - store > 0 ? [{ name: '99Food', amount: roundMoney(total - store) }] : []),
        ],
      }
    })

  const phone = address?.virtual_phone_number
    ? `${address.virtual_phone_number}${address.locator ? ` (ramal ${address.locator})` : ''}`
    : address?.phone && !address.phone.includes('*')
      ? `${address.calling_code ?? ''} ${address.phone}`.trim()
      : undefined

  const shopPaid = cents(price['shop_paid_money'])
  const notes = [
    remarkText(info.remark),
    info.need_cutlery ? 'Mandar talheres' : undefined,
    shopPaid > 0
      ? `Entregador da 99Food paga ${shopPaid.toFixed(2).replace('.', ',')} na retirada (pedido em dinheiro)`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  const cpf =
    address?.cpf !== undefined && address?.cpf !== null && String(address.cpf) !== '0'
      ? String(address.cpf).padStart(11, '0')
      : undefined

  return {
    platform: '99food',
    externalId: String(info.order_id),
    displayId: info.order_index !== undefined ? String(info.order_index) : String(info.order_id),
    merchantId: info.shop?.app_shop_id ?? shopId,
    type: pickup ? 'pickup' : 'delivery',
    customerName: address ? customerName(address) : 'Cliente 99Food',
    customerPhone: phone,
    customerDocument: cpf,
    items: (info.order_items ?? []).map((item) => {
      const quantity = item.amount ?? 1
      const total = cents(item.total_price ?? (item.sku_price ?? 0) * quantity)
      return {
        name: item.name,
        externalCode: item.app_item_id || undefined,
        quantity,
        unitPrice: roundMoney(quantity > 0 ? total / quantity : total),
        notes: remarkText(item.remark),
        options: (item.sub_item_list ?? []).map((sub) => ({
          name: sub.name,
          quantity: sub.amount ?? 1,
          unitPrice: cents(sub.sku_price),
        })),
      }
    }),
    deliveryFee,
    discount: itemsDiscount,
    benefits,
    orderAmount,
    payments: [
      {
        method: PAY_CHANNEL_LABELS[info.pay_channel ?? 0] ?? (online ? 'Online' : 'Na entrega'),
        prepaid: online,
        amount: orderAmount,
        ...(info.change_for ? { changeFor: cents(info.change_for) } : {}),
      },
    ],
    deliveryAddress:
      !pickup && formatted
        ? { formatted, complement: address?.complement || undefined, reference: address?.reference || undefined }
        : undefined,
    deliveredBy: pickup || merchantDelivers ? 'merchant' : 'platform',
    pickupCode: (pickup ? info.takeaway_code : (info.handover_code ?? info.pickup_code)) || undefined,
    notes: notes || undefined,
  }
}

function stringify(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
}

/** Ids de 64 bits vão como número no JSON sem perder dígitos. */
function jsonWithBigInts(body: Record<string, unknown>): string {
  return JSON.stringify(body, (key, value) =>
    BIGINT_KEYS.has(key) && typeof value === 'string' && /^\d+$/.test(value) ? `__big__${value}` : value,
  ).replace(/"__big__(\d+)"/g, '$1')
}

const BIGINT_KEYS = new Set(['order_id', 'apply_id'])

function safeParse(text: string): Record<string, unknown> | undefined {
  try {
    return parseJsonKeepingBigInts<Record<string, unknown>>(text)
  } catch {
    return undefined
  }
}
