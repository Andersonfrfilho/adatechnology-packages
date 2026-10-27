/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type VisionInput = Readonly<{
  buffer: Buffer
  /** Mime como veio do canal — `image/jpeg` nas fotos do WhatsApp. */
  mimeType: string
}>

/**
 * O que um engine conseguiu extrair. Os dois campos sao opcionais porque cada engine enxerga uma
 * coisa: o leitor de codigo de barras nao produz vetor, e o modelo de embedding nao le GTIN.
 *
 * Leitura vazia e resultado legitimo — foto sem codigo visivel de um produto que a loja nao vende
 * — e nao falha. E a mesma decisao do audio em silencio no `audio-transcription-provider`.
 */
export type VisionReading = Readonly<{
  barcode?: string
  embedding?: readonly number[]
  engine: string
}>

/**
 * A porta que o consumidor injeta. Estrutural de proposito: qualquer objeto com `name` e `read`
 * serve, entao o host pode passar um dublê nos testes sem importar este pacote.
 *
 * Satisfaz `ProductVisionPort` do `@adatechnology/catalog-contracts` sem importa-lo: o provider
 * nao deve depender do modulo que o consome.
 */
export type ProductVisionEngine = Readonly<{
  name: string
  /** Ausente = engine sem vetor (so leitura de codigo de barras). */
  embeddingModel?: Readonly<{ id: string; dimensions: number }>
  read: (input: VisionInput) => Promise<VisionReading>
}>

export type BarcodeReaderConfig = Readonly<{
  /**
   * Formatos aceitos. Restringir acelera a decodificacao e, mais importante, evita que um QR Code
   * colado na gondola vire "codigo do produto" — o cliente fotografa a prateleira inteira.
   */
  formats?: readonly string[]
  /**
   * Teto de pixels antes de decodificar. Foto de celular moderna passa de 12MP, e o zbar percorre
   * a imagem inteira: sem o teto, uma foto grande prende o worker por segundos.
   */
  maxPixels?: number
}>

export type ClipEmbedderConfig = Readonly<{
  /** Id do modelo no formato do transformers.js. O padrao e o CLIP ViT-B/32, de 512 dimensoes. */
  model?: string
  /**
   * Onde os pesos ficam. Sem isto o transformers.js baixa para o cache do usuario na primeira
   * chamada — o que num container efemero significa baixar a cada boot.
   */
  cacheDir?: string
  /**
   * Inferencia em CPU nao tem teto natural: uma imagem grande com modelo grande prende o processo
   * indefinidamente. O timeout e o que impede uma unica foto de travar o worker.
   */
  timeoutMs?: number
}>
