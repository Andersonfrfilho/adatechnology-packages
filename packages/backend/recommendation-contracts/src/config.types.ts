/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A configuração de boot: o que é ESTRUTURAL e fica em código.
 *
 * Tipos de item, planos e espaços são decididos pelo produto, não pela tela. Um espaço novo só
 * existe quando alguma tela do produto sabe desenhá-lo; um tipo novo só existe quando o produto
 * sabe o que fazer com os campos dele. Deixar isso editável em execução criaria recomendação que
 * nenhuma tela mostra.
 */

export const FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  URL: 'url',
} as const

export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE]

/** `name` vira chave de `attributes`; a forma estável evita chave com espaço ou acento. */
export const NAME_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/

export type FieldOption = {
  readonly value: string
  readonly label: string
}

export type FieldDefinition = {
  readonly name: string
  readonly label: string
  readonly type: FieldType
  readonly required: boolean
  /** Obrigatório quando `type` é `select`; ignorado nos demais. */
  readonly options?: readonly FieldOption[]
}

/**
 * O que pode ser recomendado: lugar, evento, produto, serviço, conteúdo. Os campos comuns (título,
 * resumo, imagem, link, cidade, faixa de idade, tags) valem para todo tipo; os específicos ficam
 * em `fields` e são gravados em `attributes`.
 */
export type KindDefinition = {
  readonly name: string
  readonly label: string
  readonly fields: readonly FieldDefinition[]
}

/**
 * Plano de campanha patrocinada. `weight` ordena o feed: o plano mais caro aparece antes.
 *
 * O preço NÃO mora aqui: cobrança é outro módulo. Este pacote só pergunta, pela
 * `CampaignEntitlementPort`, se o anunciante pode usar o plano.
 */
export type PlanDefinition = {
  readonly name: string
  readonly label: string
  readonly weight: number
}

/** Onde o produto desenha recomendações: "card da Início", "feed da comunidade". */
export type PlacementDefinition = {
  readonly name: string
  readonly label: string
  /** Teto de itens patrocinados neste espaço. Ausente usa `maxSponsoredPerFeed`. */
  readonly maxSponsored?: number
}

export type TenancyConfig = { readonly mode: 'single' } | { readonly mode: 'multi' }

export type RecommendationModuleConfig = {
  readonly tenancy: TenancyConfig
  readonly kinds: readonly KindDefinition[]
  readonly plans: readonly PlanDefinition[]
  readonly placements: readonly PlacementDefinition[]
  /** Teto padrão de patrocinados por feed. Padrão: 2. */
  readonly maxSponsoredPerFeed?: number
  /** Itens por feed quando o pedido não diz. Padrão: 6. */
  readonly defaultFeedLimit?: number
  /**
   * Fuso que decide em que DIA cai uma impressão. Padrão: `UTC`. Produto brasileiro quer
   * `America/Sao_Paulo`, senão o clique das 22h aparece no relatório do dia seguinte.
   */
  readonly timeZone?: string
}

export const DEFAULT_MAX_SPONSORED_PER_FEED = 2
export const DEFAULT_FEED_LIMIT = 6
export const MAX_FEED_LIMIT = 30

/** O que a tela de administração precisa saber para desenhar formulários e filtros. */
export type RecommendationSettings = {
  readonly kinds: readonly KindDefinition[]
  readonly plans: readonly PlanDefinition[]
  readonly placements: readonly PlacementDefinition[]
}
