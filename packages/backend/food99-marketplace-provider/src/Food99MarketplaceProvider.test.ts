import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  Food99MarketplaceProvider,
  food99CancellationCode,
  mapFood99Bill,
  mapFood99Order,
} from './Food99MarketplaceProvider'

interface Call {
  url: string
  init: RequestInit | undefined
}

const ok = (data: unknown) => new Response(JSON.stringify({ errno: 0, errmsg: 'ok', requestId: 'r1', data }))

function fakeFetch(respond: (url: string, init?: RequestInit) => Response | undefined) {
  const calls: Call[] = []
  const fetchFunction = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init })
    if (url.includes('/v1/auth/authtoken/get'))
      return ok({ auth_token: 'shop-token', token_expiration_time: Math.floor(Date.now() / 1000) + 86400 })
    return respond(url, init) ?? ok({})
  }
  return { calls, fetchFunction }
}

const config = { appId: 'app', appSecret: 'secret', shopIds: ['shop-1'], baseUrl: 'https://food99.test' }

// Id de 64 bits que perde dígitos se passar por Number.
const BIG_ORDER_ID = '5764607523034234881'

const orderInfo = {
  order_id: BIG_ORDER_ID,
  order_index: 42,
  pay_method: 2,
  pay_channel: 153,
  change_for: 10000,
  delivery_type: 2,
  fulfillment_mode: 2,
  handover_code: '1234',
  need_cutlery: true,
  remark: 'Sem cebola',
  price: { order_price: 6000, items_discount: 500, delivery_price: 799, real_pay_price: 6299, shop_paid_money: 0 },
  shop: { app_shop_id: 'shop-1' },
  receive_address: {
    name: 'Ana',
    cpf: 1234567890,
    calling_code: '+55',
    phone: '11999990000',
    formatted_address: 'Rua das Flores, 10 - Centro',
    complement: 'Apto 3',
  },
  order_items: [{ app_item_id: 'HR10', name: 'Hot Roll', amount: 2, total_price: 6000, sub_item_list: [] }],
  promotions: [{ promo_discount: 500, shop_subside_price: 200 }],
}

describe('Food99MarketplaceProvider', () => {
  it('confere o webhook com MD5 do corpo + app_secret e mantém o id de 64 bits', () => {
    const provider = new Food99MarketplaceProvider(config)
    const raw = Buffer.from(
      `{"app_shop_id":"shop-1","type":"orderNew","timestamp":1700000000,"data":{"order_id":${BIG_ORDER_ID}}}`,
    )
    const sign = createHash('md5')
      .update(Buffer.concat([raw, Buffer.from('secret')]))
      .digest('hex')
    expect(provider.verifyWebhook(raw, { 'didi-header-sign': sign })).toBe(true)
    expect(provider.verifyWebhook(raw, { 'didi-header-sign': 'a'.repeat(32) })).toBe(false)
    expect(provider.verifyWebhook(raw, {})).toBe(false)

    const [event] = provider.parseWebhook(raw)
    expect(event).toMatchObject({
      id: `orderNew:${BIG_ORDER_ID}`,
      kind: 'placed',
      orderId: BIG_ORDER_ID,
      merchantId: 'shop-1',
    })
    expect(provider.webhookResponse(true)).toEqual({ status: 200, body: { errno: 0, errmsg: 'ok' } })
  })

  it('pedido de cancelamento do cliente vira negociação com prazo de 5 min', () => {
    const provider = new Food99MarketplaceProvider(config)
    const raw = Buffer.from(
      `{"app_shop_id":"shop-1","type":"orderCancelApply","timestamp":1700000000,"data":{"order_id":${BIG_ORDER_ID},"apply_id":77,"apply_reason":"Demorou"}}`,
    )
    const [event] = provider.parseWebhook(raw)
    expect(event!.kind).toBe('dispute_opened')
    const dispute = provider.parseDispute(event!)
    expect(dispute).toMatchObject({
      externalId: 'cancel:77',
      kind: 'cancellation',
      message: 'Demorou',
      alternatives: [],
    })
    expect(Date.parse(dispute!.expiresAt!) - 1700000000 * 1000).toBe(5 * 60_000)
  })

  it('ações vão para os endereços da 99Food com o token da loja e o id sem perder dígitos', async () => {
    const { calls, fetchFunction } = fakeFetch(() => undefined)
    const provider = new Food99MarketplaceProvider(config, fetchFunction)
    await provider.sendAction(BIG_ORDER_ID, 'confirm')
    await provider.sendAction(BIG_ORDER_ID, 'startPreparation')
    await provider.sendAction(BIG_ORDER_ID, 'readyForPickup')
    await provider.sendAction(BIG_ORDER_ID, 'dispatch', { courier: { name: 'João Silva', phone: '5511988887777' } })
    await provider.sendAction(BIG_ORDER_ID, 'delivered')
    await provider.sendAction(BIG_ORDER_ID, 'pickedUp')
    const posts = calls.filter((call) => call.init?.method === 'POST')
    expect(posts.map((call) => call.url.replace('https://food99.test', ''))).toEqual([
      '/v1/order/order/confirm',
      '/v1/order/order/ready',
      '/v1/order/selfdelivery/dispatch',
      '/v1/order/selfdelivery/delivered',
      '/v1/order/order/finish',
    ])
    const body = String(posts[0]!.init!.body)
    expect(body).toContain(`"order_id":${BIG_ORDER_ID}`)
    expect(body).toContain('"auth_token":"shop-token"')
    const dispatch = JSON.parse(String(posts[2]!.init!.body).replace(/"order_id":(\d+)/, '"order_id":"$1"'))
    expect(dispatch.courier_info).toMatchObject({
      courier_first_name: 'João',
      courier_last_name: 'Silva',
      courier_phone: '11988887777',
    })
  })

  it('token vencido (10102) renova e repete uma vez', async () => {
    let tokens = 0
    let confirms = 0
    const fetchFunction = async (url: string): Promise<Response> => {
      if (url.includes('/authtoken/get')) {
        tokens += 1
        return ok({ auth_token: `t${tokens}`, token_expiration_time: Math.floor(Date.now() / 1000) + 86400 })
      }
      confirms += 1
      return confirms === 1 ? new Response(JSON.stringify({ errno: 10102, errmsg: 'token expired' })) : ok({})
    }
    const provider = new Food99MarketplaceProvider(config, fetchFunction)
    await provider.sendAction('1', 'confirm')
    expect(tokens).toBe(2)
    expect(confirms).toBe(2)
  })

  it('erro da 99Food (errno) vira exceção', async () => {
    const { fetchFunction } = fakeFetch(
      () => new Response(JSON.stringify({ errno: 20001, errmsg: 'order status error' })),
    )
    const provider = new Food99MarketplaceProvider(config, fetchFunction)
    await expect(provider.sendAction('1', 'confirm')).rejects.toThrow('20001')
  })

  it('cancelamento com reason_id e motivos de entrega própria só quando a loja entrega', async () => {
    const { calls, fetchFunction } = fakeFetch(() => undefined)
    const provider = new Food99MarketplaceProvider(config, fetchFunction)
    const platformDelivery = await provider.cancellationReasons('1', { deliveredBy: 'platform', type: 'delivery' })
    const ownDelivery = await provider.cancellationReasons('1', { deliveredBy: 'merchant', type: 'delivery' })
    expect(platformDelivery.some((reason) => reason.code === '1060')).toBe(false)
    expect(ownDelivery.some((reason) => reason.code === '1060')).toBe(true)
    await provider.requestCancellation('1', { reason: 'Acabou o salmão' })
    expect(JSON.parse(String(calls.at(-1)!.init!.body))).toMatchObject({ reason_id: 1010, reason: 'Acabou o salmão' })
    expect(food99CancellationCode('qualquer coisa')).toBe('1080')
  })

  it('responde pedido de reembolso (aceitar/recusar) e recusa contraproposta', async () => {
    const { calls, fetchFunction } = fakeFetch(() => undefined)
    const provider = new Food99MarketplaceProvider(config, fetchFunction)
    const dispute = { externalId: 'refund:9', orderExternalId: '1', kind: 'refund' as const, alternatives: [] }
    await provider.respondDispute(dispute, { decision: 'reject', reason: 'Item foi entregue' })
    expect(calls.at(-1)!.url).toBe('https://food99.test/v1/order/apply/refund')
    expect(JSON.parse(String(calls.at(-1)!.init!.body))).toMatchObject({
      apply_id: 9,
      agree: false,
      reason: 'Item foi entregue',
    })
    await expect(provider.respondDispute(dispute, { decision: 'alternative', alternativeId: 'x' })).rejects.toThrow()
  })
})

describe('mapFood99Order', () => {
  it('converte centavos, entrega própria, troco, cupom e CPF', () => {
    const order = mapFood99Order(orderInfo)
    expect(order).toMatchObject({
      externalId: BIG_ORDER_ID,
      displayId: '42',
      merchantId: 'shop-1',
      type: 'delivery',
      deliveredBy: 'merchant',
      customerName: 'Ana',
      customerDocument: '01234567890',
      deliveryFee: 7.99,
      discount: 5,
      orderAmount: 62.99,
      pickupCode: '1234',
      deliveryAddress: { formatted: 'Rua das Flores, 10 - Centro', complement: 'Apto 3' },
    })
    expect(order.payments[0]).toMatchObject({ method: 'Dinheiro', prepaid: false, changeFor: 100 })
    expect(order.items[0]).toMatchObject({ name: 'Hot Roll', externalCode: 'HR10', quantity: 2, unitPrice: 30 })
    expect(order.benefits).toEqual([
      {
        amount: 5,
        sponsors: [
          { name: 'loja', amount: 2 },
          { name: '99Food', amount: 3 },
        ],
      },
    ])
    expect(order.notes).toContain('Sem cebola')
    expect(order.notes).toContain('Mandar talheres')
  })

  it('retirada e entrega da 99Food; nome escondido vira genérico', () => {
    const pickup = mapFood99Order({ ...orderInfo, fulfillment_mode: 1, delivery_type: 0, takeaway_code: '9999' })
    expect(pickup).toMatchObject({ type: 'pickup', deliveredBy: 'merchant', deliveryFee: 0, pickupCode: '9999' })
    expect(pickup.deliveryAddress).toBeUndefined()
    const platform = mapFood99Order({ ...orderInfo, delivery_type: 1, receive_address: { name: 'Privacy Protection' } })
    expect(platform).toMatchObject({ deliveredBy: 'platform', deliveryFee: 0, customerName: 'Cliente 99Food' })
  })
})

describe('mapFood99Bill', () => {
  it('soma bruto e separa comissão, taxas e subsídios com sinal', () => {
    const sale = mapFood99Bill('shop-1', {
      orderId: BIG_ORDER_ID,
      orderIndex: 42,
      orderType: 1,
      businessDateTime: '2026-11-01 12:00:00',
      mealOriginalAmount: 6000,
      shopDeliveryAmount: 799,
      commissionAmount: 720,
      payCommissionAmount: 190,
      shopActivitySubsidy: 300,
      settlementAmount: 6189,
      paymentChannel: 212,
      expectSettleDate: '2026-11-08',
    })
    expect(sale).toMatchObject({
      grossAmount: 67.99,
      netAmount: 61.89,
      status: 'Venda',
      paymentMethod: 'Pix',
      displayId: '42',
    })
    expect(sale.entries).toEqual([
      { label: 'Comissão', amount: -7.2 },
      { label: 'Taxa de pagamento', amount: -1.9 },
      { label: 'Desconto pago pela 99Food', amount: 3 },
    ])
  })
})
