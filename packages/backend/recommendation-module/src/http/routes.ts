/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tabela de rotas do módulo. Ela declara autorização; o despachante do host é quem aplica.
 *
 * - **`companyId` SEMPRE do `auth`**, nunca do corpo ou da query.
 * - **Dois públicos, dois escopos.** O feed e o rastreio servem a qualquer usuário autenticado do
 *   produto; tudo que cria, edita ou mostra número de anunciante é `recommendations:admin`.
 */

import {
  createCampaignSchema,
  createItemSchema,
  feedQuerySchema,
  listItemsSchema,
  statsQuerySchema,
  trackEventSchema,
  updateCampaignSchema,
  updateItemSchema,
  type CreateCampaignInput,
  type CreateItemInput,
  type FeedQuery,
  type ListItemsQuery,
  type StatsQuery,
  type TrackEventInput,
  type UpdateCampaignInput,
  type UpdateItemInput,
} from '@adatechnology/recommendation-contracts'
import { ROUTE_SCOPE, type ModuleRoute, type ModuleRouteTable, type RequestContext } from '@adatechnology/module-http'

import type { RecommendationModule } from '../RecommendationModule'
import { resolveScopeCompanyId } from '../shared/tenancy'

export const RECOMMENDATION_SCOPE = {
  ADMIN: 'recommendations:admin',
} as const

export type CreateRecommendationRoutesParams = {
  readonly module: RecommendationModule
  /**
   * Grupos publicados. O app do usuário final que só MOSTRA recomendação não precisa expor a
   * administração — capacidade por ausência, não por flag no corpo.
   */
  readonly features?: { readonly feed?: boolean; readonly admin?: boolean }
}

export function createRecommendationRoutes(params: CreateRecommendationRoutesParams): ModuleRouteTable {
  const { module } = params
  const { useCases } = module
  const feed = params.features?.feed ?? true
  const admin = params.features?.admin ?? true

  function scoped(context: RequestContext): { companyId?: string } {
    const companyId = resolveScopeCompanyId({ tenancy: module.config.tenancy, explicit: context.auth?.companyId })
    return companyId === undefined ? {} : { companyId }
  }

  const id = (context: RequestContext, name = 'id'): string => context.params[name] ?? ''

  const feedRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: '/recommendations',
      scope: ROUTE_SCOPE.USER,
      querySchema: feedQuerySchema,
      operationId: 'getRecommendationFeed',
      summary: 'Recomendações para um espaço da tela, patrocinadas primeiro e sempre marcadas',
      async handler(context) {
        const query = context.query as unknown as FeedQuery
        const data = await useCases.getFeed.execute({ ...scoped(context), query })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      method: 'POST',
      path: '/recommendations/events',
      scope: ROUTE_SCOPE.USER,
      bodySchema: trackEventSchema,
      operationId: 'trackRecommendationEvent',
      summary: 'Conta uma impressão ou um clique',
      async handler(context) {
        await useCases.trackEvent.execute({ ...scoped(context), input: context.body as TrackEventInput })
        return { kind: 'empty', status: 204 }
      },
    },
  ]

  const adminRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: '/recommendation-settings',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      operationId: 'getRecommendationSettings',
      summary: 'Tipos, planos e espaços declarados pelo produto',
      async handler() {
        return { kind: 'json', status: 200, body: { data: module.settings } }
      },
    },
    {
      method: 'GET',
      path: '/recommendation-items',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      querySchema: listItemsSchema,
      operationId: 'listRecommendationItems',
      summary: 'Lista recomendações com filtro por tipo, origem, situação e anunciante',
      async handler(context) {
        const query = context.query as unknown as ListItemsQuery
        const result = await useCases.listItems.execute({ ...scoped(context), query })
        return { kind: 'json', status: 200, body: result }
      },
    },
    {
      method: 'POST',
      path: '/recommendation-items',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      bodySchema: createItemSchema,
      operationId: 'createRecommendationItem',
      summary: 'Cria uma recomendação (patrocinada ou da curadoria)',
      async handler(context) {
        const data = await useCases.createItem.execute({ ...scoped(context), input: context.body as CreateItemInput })
        return { kind: 'json', status: 201, body: { data } }
      },
    },
    {
      method: 'GET',
      path: '/recommendation-items/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      operationId: 'getRecommendationItem',
      summary: 'Recomendação com as campanhas',
      async handler(context) {
        const data = await useCases.getItem.execute({ ...scoped(context), id: id(context) })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      method: 'PATCH',
      path: '/recommendation-items/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      bodySchema: updateItemSchema,
      operationId: 'updateRecommendationItem',
      summary: 'Edita, publica, pausa ou arquiva uma recomendação',
      async handler(context) {
        const data = await useCases.updateItem.execute({
          ...scoped(context),
          id: id(context),
          input: context.body as UpdateItemInput,
        })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      method: 'POST',
      path: '/recommendation-items/:id/campaigns',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      bodySchema: createCampaignSchema,
      operationId: 'createRecommendationCampaign',
      summary: 'Abre uma campanha paga para uma recomendação patrocinada',
      async handler(context) {
        const data = await useCases.createCampaign.execute({
          ...scoped(context),
          itemId: id(context),
          input: context.body as CreateCampaignInput,
        })
        return { kind: 'json', status: 201, body: { data } }
      },
    },
    {
      method: 'PATCH',
      path: '/recommendation-campaigns/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      bodySchema: updateCampaignSchema,
      operationId: 'updateRecommendationCampaign',
      summary: 'Muda plano, período, espaços ou situação da campanha',
      async handler(context) {
        const data = await useCases.updateCampaign.execute({
          ...scoped(context),
          id: id(context),
          input: context.body as UpdateCampaignInput,
        })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      method: 'GET',
      path: '/recommendation-stats',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [RECOMMENDATION_SCOPE.ADMIN],
      querySchema: statsQuerySchema,
      operationId: 'getRecommendationStats',
      summary: 'Impressões e cliques por campanha no período',
      async handler(context) {
        const query = context.query as unknown as StatsQuery
        const data = await useCases.getStats.execute({ ...scoped(context), query })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
  ]

  return [...(feed ? feedRoutes : []), ...(admin ? adminRoutes : [])]
}
