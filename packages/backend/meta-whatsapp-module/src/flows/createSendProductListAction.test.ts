/**
 * A vitrine é a única action que fala com o catálogo, e o que ela promete tem de estar travado
 * aqui: item esgotado nunca sai, teto da Meta respeitado, e falha de envio não trava a conversa.
 */

import { describe, expect, it, mock } from 'bun:test'
import type {
  CatalogPort,
  CatalogProduct,
  ChannelAdapterInterface,
  ConversationSession,
  FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import { createSendProductListAction, PRODUCT_LIST_LIMIT } from './createSendProductListAction'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'

const session = {
  companyId: 'company-1',
  whatsappNumber: '5511900000000',
  flowKey: 'consorcio',
} as unknown as ConversationSession

function nodeWith(actionParams?: Record<string, unknown>): FlowNodeData {
  return { id: 'vitrine', type: 'action', actionKind: 'send_product_list', ...(actionParams ? { actionParams } : {}) }
}

function productOf(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    retailerId: 'produto-1',
    name: 'Cota de consórcio',
    priceInCents: 10_000,
    currency: 'BRL',
    availability: 'in stock',
    ...overrides,
  }
}

type SendProductListParams = Parameters<NonNullable<ChannelAdapterInterface['sendProductList']>>[0]

function harness(products: CatalogProduct[]) {
  const listProducts = mock(async () => products)
  const sendProductList = mock<(params: SendProductListParams) => Promise<{ externalMessageId: string | null }>>(
    async () => ({ externalMessageId: 'wamid.1' }),
  )
  const logExecute = mock<(params: Parameters<LogMessageUseCase['execute']>[0]) => Promise<undefined>>(
    async () => undefined,
  )
  const onError = mock<(error: unknown, details: { flowKey: string; nodeId: string }) => void>(() => undefined)

  const handler = createSendProductListAction({
    catalog: { listProducts } as unknown as CatalogPort,
    catalogId: 'catalogo-1',
    logMessage: { execute: logExecute } as unknown as LogMessageUseCase,
    startState: 'start',
    onError,
  })

  return { handler, listProducts, sendProductList, logExecute, onError }
}

const channelWith = (sendProductList?: unknown) => ({ sendProductList }) as unknown as ChannelAdapterInterface

const invoke = (
  handler: ReturnType<typeof createSendProductListAction>,
  channel: ChannelAdapterInterface,
  node = nodeWith(),
) => handler({ node, session, channel, context: {} })

describe('createSendProductListAction', () => {
  it('canal sem vitrine não envia nada e nem consulta o catálogo', async () => {
    const { handler, listProducts } = harness([productOf({})])

    await invoke(handler, channelWith(undefined))

    expect(listProducts).not.toHaveBeenCalled()
  })

  it('manda só o que está em estoque', async () => {
    const { handler, sendProductList } = harness([
      productOf({ retailerId: 'tem' }),
      productOf({ retailerId: 'acabou', availability: 'out of stock' }),
    ])

    await invoke(handler, channelWith(sendProductList))

    expect(sendProductList.mock.calls[0]?.[0].sections[0]?.retailerIds).toEqual(['tem'])
  })

  it('catálogo sem nenhum item disponível não vira vitrine vazia', async () => {
    const { handler, sendProductList, logExecute } = harness([productOf({ availability: 'out of stock' })])

    await invoke(handler, channelWith(sendProductList))

    expect(sendProductList).not.toHaveBeenCalled()
    expect(logExecute).not.toHaveBeenCalled()
  })

  it('corta no teto da Meta em vez de deixar a mensagem inteira ser recusada', async () => {
    const products = Array.from({ length: PRODUCT_LIST_LIMIT.ITEMS + 5 }, (_unused, index) =>
      productOf({ retailerId: `produto-${index}` }),
    )
    const { handler, sendProductList } = harness(products)

    await invoke(handler, channelWith(sendProductList))

    expect(sendProductList.mock.calls[0]?.[0].sections[0]?.retailerIds).toHaveLength(PRODUCT_LIST_LIMIT.ITEMS)
  })

  it('o nó guarda critério: o filtro do operador vai para a consulta do catálogo', async () => {
    const { handler, listProducts, sendProductList } = harness([productOf({})])

    await invoke(handler, channelWith(sendProductList), nodeWith({ search: 'imovel' }))

    expect(listProducts).toHaveBeenCalledWith({ catalogId: 'catalogo-1', search: 'imovel' })
  })

  it('o transcript guarda texto e contagem, nunca o preço de cada item', async () => {
    const { handler, sendProductList, logExecute } = harness([
      productOf({ retailerId: 'a' }),
      productOf({ retailerId: 'b' }),
    ])

    await invoke(handler, channelWith(sendProductList), nodeWith({ bodyText: 'Escolha uma cota:' }))

    const logged = logExecute.mock.calls[0]?.[0]
    expect(logged).toMatchObject({
      direction: 'outbound',
      sender: 'bot',
      type: 'interactive',
      content: 'Escolha uma cota:',
      waMessageId: 'wamid.1',
      status: 'sent',
      payload: { kind: 'product_list', productCount: 2 },
    })
    expect(JSON.stringify(logged?.payload)).not.toContain('10000')
  })

  it('falha de envio vai para o hook e a conversa segue', async () => {
    const { handler, onError, logExecute } = harness([productOf({})])
    const failure = new Error('meta recusou')

    await invoke(
      handler,
      channelWith(
        mock(async () => {
          throw failure
        }),
      ),
    )

    expect(onError).toHaveBeenCalledWith(failure, { flowKey: 'consorcio', nodeId: 'vitrine' })
    expect(logExecute).not.toHaveBeenCalled()
  })
})
