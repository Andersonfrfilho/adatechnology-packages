/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CompanyId, MetaSyncConfig, Product, ProductAvailability, ProductId } from './catalog.types'

/**
 * Upload de imagem de produto. Porta e não implementação porque o bucket é do host — e o pacote
 * não deve escolher entre S3, MinIO ou disco local por ele.
 * `@adatechnology/object-storage-provider` satisfaz esta forma.
 */
export interface ProductImageStoragePort {
  upload(params: {
    readonly buffer: Buffer
    readonly mimeType: string
    readonly key: string
  }): Promise<{ readonly url: string; readonly key: string }>
  delete?(key: string): Promise<void>
  /**
   * Leitura pela chave, para reprocessar a imagem já guardada — hoje só a indexação visual
   * (`ProductVisionPort`) precisa, e sem ela não há como gerar o vetor de um produto cadastrado.
   *
   * É pela `key` e não pela `imageUrl` de propósito: bucket privado entrega URL assinada de vida
   * curta, e uma URL gravada em `products.image_url` meses atrás já expirou quando a indexação roda.
   *
   * Opcional porque storage só de escrita continua válido para quem não indexa imagem.
   */
  fetch?(key: string): Promise<{ readonly buffer: Buffer; readonly mimeType: string }>
}

export type MetaProductPayload = {
  readonly retailerId: string
  readonly name: string
  readonly description: string
  readonly priceInCents: number
  readonly currency: string
  readonly imageUrl?: string
  readonly availability: ProductAvailability
}

export type MetaSyncOutcome =
  | { readonly outcome: 'synced'; readonly externalId: string }
  /** Erro do payload ou da conta: repetir não resolve, e a linha fica `failed` com o motivo. */
  | { readonly outcome: 'permanent'; readonly errorCode: string; readonly message: string }
  /** Rate limit ou indisponibilidade: o worker tenta de novo com backoff. */
  | { readonly outcome: 'retriable'; readonly errorCode: string; readonly message: string }

/**
 * Publicação na Meta Commerce. Satisfeita por um adaptador sobre o
 * `@adatechnology/meta-catalog-provider` (esse sim específico da Meta) — que o módulo **não importa**, para quem só quer
 * gerenciar catálogo interno não carregar cliente de Graph API (granularidade, §2 da regra).
 *
 * Ausente = `metaSync` desligado, e o módulo funciona inteiro sem ela.
 */
export interface MetaCatalogSyncPort {
  upsertProduct(payload: MetaProductPayload): Promise<MetaSyncOutcome>
  deleteProduct(externalId: string): Promise<void>
  upsertProductSet(params: { readonly name: string; readonly externalId?: string }): Promise<MetaSyncOutcome>
  deleteProductSet(externalId: string): Promise<void>
}

/**
 * Sugestão vinda de base externa (GTIN, OpenFoodFacts, distribuidor) para pré-preencher o
 * formulário. Opcional: sem ela, o campo de código de barras é só um campo.
 */
export interface ProductSuggestionPort {
  findByBarcode(barcode: string): Promise<
    | {
        readonly name: string
        readonly brand?: string
        readonly imageUrl?: string
        readonly category?: string
      }
    | undefined
  >
}

/**
 * Guarda de reentrega do webhook. A Meta reentrega o mesmo evento quando o 200 demora ou se perde,
 * e sem isto um evento de catálogo seria processado duas vezes.
 *
 * Porta e não implementação: o host já tem Redis (ou o que for) — o pacote não escolhe por ele.
 * Ausente = sem proteção de reentrega, e o módulo diz isso no log em vez de fingir idempotência.
 */
export interface WebhookNonceStorePort {
  /** `true` = a chave foi criada agora (entrega inédita); `false` = já existia (reentrega). */
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
}

/**
 * Uma leitura da imagem: o que os engines conseguiram extrair dela. Os dois campos são opcionais
 * porque cada engine enxerga uma coisa — o leitor de código de barras não produz vetor, e o
 * modelo de embedding não lê GTIN.
 */
export type ProductVisionReading = Readonly<{
  /**
   * GTIN/EAN decodificado da embalagem. Quando vem, decide sozinho: `products.barcode` é único por
   * empresa, então o casamento é exato e não passa por similaridade.
   */
  barcode?: string
  /**
   * Vetor da imagem, na dimensão declarada em `embeddingModel`. Só serve para comparar com vetores
   * do MESMO modelo — trocar de modelo invalida o índice inteiro, e é por isso que o id do modelo
   * viaja junto em vez de ficar implícito na configuração.
   */
  embedding?: readonly number[]
  /** Qual engine respondeu. Numa cadeia é a única forma de saber quem produziu a leitura. */
  engine: string
}>

/** Candidato que o módulo achou pelo vetor e leva ao desempate. */
export type ProductVisionCandidate = Readonly<{
  productId: ProductId
  name: string
  imageUrl?: string
  /** Distância de cosseno normalizada: 1 é idêntico. */
  score: number
}>

export type ProductVisionRanking = Readonly<{
  /**
   * `undefined` é resposta legítima e o caso mais importante: significa "nenhum destes", e é o que
   * impede o desempate de escolher o menos ruim quando o cliente fotografou algo que a loja não vende.
   */
  productId?: ProductId
  engine: string
}>

/**
 * Identificação visual de produto. Ausente = a busca por imagem não existe no produto, e o canal
 * segue tratando foto como mensagem não suportada.
 *
 * Satisfeita pelo `@adatechnology/product-vision-provider`, que o módulo **não importa**: quem só
 * quer gerenciar catálogo não carrega runtime de ONNX nem WASM de leitor de código de barras.
 */
export interface ProductVisionPort {
  readonly name: string
  /**
   * Declarado, e não inferido do primeiro vetor: a dimensão define a coluna do índice, e o módulo
   * precisa recusar no boot um provider que não bate com o que já está indexado — descobrir isso
   * na primeira busca seria descobrir com o cliente esperando.
   *
   * Ausente = engine sem vetor (só leitura de código de barras). É o modo em que um catálogo sem
   * foto cadastrada ainda identifica produto.
   */
  readonly embeddingModel?: Readonly<{ id: string; dimensions: number }>
  read(input: Readonly<{ buffer: Buffer; mimeType: string }>): Promise<ProductVisionReading>
  /**
   * Desempate entre os candidatos que a busca vetorial trouxe. Opcional porque custa um modelo de
   * visão rodando, e a cascata resolve sem ele: sem `rank`, o módulo devolve os candidatos e quem
   * escolhe é a pessoa do outro lado da conversa.
   */
  rank?(
    params: Readonly<{
      image: Readonly<{ buffer: Buffer; mimeType: string }>
      candidates: readonly ProductVisionCandidate[]
    }>,
  ): Promise<ProductVisionRanking>
}

export interface ClockPort {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export type CatalogModuleConfig = {
  /** ISO 4217 — usado no payload da Meta e na conversão da importação em lote. */
  readonly currency: string
  readonly locale: string
  readonly metaSync?: MetaSyncConfig
  /**
   * Estoque zero derruba a disponibilidade automaticamente. Desligado, `availability` é decisão
   * manual — é o caso de quem vende sob encomenda e não quer sumir do catálogo por estar zerado.
   */
  readonly deriveAvailabilityFromInventory?: boolean
  readonly webhook?: CatalogWebhookConfig
}

/**
 * Webhook de catálogo. **Ausente = a rota não é publicada**, e não uma rota que aceita tudo: sem
 * segredo não há como distinguir a Meta de qualquer um que descubra a URL (fail-closed, §3 da
 * regra de segurança).
 */
export type CatalogWebhookConfig = {
  /** Segredo do app Meta; assina o corpo em `X-Hub-Signature-256`. */
  readonly appSecret: string
  /** O token que a Meta devolve no desafio `GET` ao salvar a URL no painel. */
  readonly verifyToken: string
}

/** Projeção usada pelo canal de conversa (`meta-whatsapp-module` pluga isto no `CatalogPort`). */
export type CatalogProductLookup = {
  findByRetailerId(params: { readonly companyId: CompanyId; readonly retailerId: string }): Promise<Product | undefined>
  listForChannel(params: { readonly companyId: CompanyId; readonly search?: string }): Promise<readonly Product[]>
  consumeInventory(params: {
    readonly companyId: CompanyId
    readonly productId: string
    readonly quantity: number
  }): Promise<void>
}
