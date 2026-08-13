import type {
  CatalogPort,
  CatalogProduct,
  FlowActionHandler,
  SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowMediaTranscriptLogger } from './createSendMediaAction'

/** Tetos da Meta para `interactive.product_list`. Acima disso a mensagem inteira é recusada. */
export const PRODUCT_LIST_LIMIT = {
  ITEMS: 30,
  SECTIONS: 10,
} as const

export type CreateSendProductListActionParams = {
  catalog: CatalogPort
  catalogId: string
  logMessage: FlowMediaTranscriptLogger
  startState: SessionState
  /** Falha de UMA vitrine não pode travar a conversa; o host observa por aqui. */
  onError?: (error: unknown, details: { flowKey: string; nodeId: string }) => void
}

type ProductListParams = {
  readonly headerText?: string
  readonly bodyText?: string
  readonly footerText?: string
  readonly search?: string
  readonly sectionTitle?: string
}

/**
 * Action `send_product_list`: ao passar pelo nó, envia a vitrine do catálogo publicado na Meta.
 *
 * O nó guarda **critério**, não a lista de produtos. Congelar `retailerId` em `actionParams` faria
 * o fluxo continuar oferecendo o item esgotado — ou o item excluído, que a Meta recusa junto com a
 * mensagem inteira. O que o operador edita é o texto e o filtro; o estoque manda no resto.
 *
 * Só produto em estoque entra. Vitrine que mostra o que não tem produz a pior conversa possível:
 * o cliente escolhe, responde, e recebe "acabou".
 */
export function createSendProductListAction(params: CreateSendProductListActionParams): FlowActionHandler {
  return async ({ node, session, channel }) => {
    // Canal sem vitrine (widget, ou dublê de teste): a capacidade some por ausência do método.
    if (!channel.sendProductList) return

    const actionParams = (node.actionParams ?? {}) as ProductListParams

    try {
      const available = await listAvailableProducts({
        catalog: params.catalog,
        catalogId: params.catalogId,
        ...(actionParams.search ? { search: actionParams.search } : {}),
      })

      // Sem item disponível não sai vitrine vazia: a Meta recusa `sections` sem produto, e o nó
      // seguinte do fluxo é quem sabe o que dizer para quem chegou com o estoque zerado.
      if (available.length === 0) return

      const bodyText = actionParams.bodyText ?? 'Veja o que temos disponível:'

      const { externalMessageId } = await channel.sendProductList({
        to: session.whatsappNumber,
        headerText: actionParams.headerText ?? 'Nossos produtos',
        body: bodyText,
        ...(actionParams.footerText ? { footerText: actionParams.footerText } : {}),
        sections: [
          {
            title: actionParams.sectionTitle ?? 'Disponíveis',
            retailerIds: available.map((product) => product.retailerId),
          },
        ],
      })

      /**
       * O transcript guarda o texto e a contagem, e não o preço de cada item: o painel precisa
       * saber que a vitrine saiu, e o histórico de conversa não é lugar de tabela de preços — ele
       * envelheceria errado no dia seguinte ao reajuste.
       */
      await params.logMessage.execute({
        companyId: session.companyId,
        whatsappNumber: session.whatsappNumber,
        direction: 'outbound',
        sender: 'bot',
        agentUserId: null,
        type: 'interactive',
        content: bodyText,
        payload: { kind: 'product_list', productCount: available.length },
        waMessageId: externalMessageId,
        status: 'sent',
        startState: params.startState,
      })
    } catch (error) {
      params.onError?.(error, { flowKey: session.flowKey ?? '', nodeId: node.id })
    }
  }
}

async function listAvailableProducts(params: {
  catalog: CatalogPort
  catalogId: string
  search?: string
}): Promise<readonly CatalogProduct[]> {
  const products = await params.catalog.listProducts({
    catalogId: params.catalogId,
    ...(params.search ? { search: params.search } : {}),
  })

  return products.filter((product) => product.availability === 'in stock').slice(0, PRODUCT_LIST_LIMIT.ITEMS)
}
