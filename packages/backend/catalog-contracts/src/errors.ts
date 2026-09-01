/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida: pacote publicado não importa o `DomainError` do host. Molde:
 * `meta-whatsapp-contracts/src/errors.ts`.
 */

export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'CatalogError'
  }
}

export const CATALOG_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'CATALOG_PRODUCT_NOT_FOUND',
  CATALOG_NOT_FOUND: 'CATALOG_CATALOG_NOT_FOUND',
  SECTION_NOT_FOUND: 'CATALOG_SECTION_NOT_FOUND',
  DUPLICATE_BARCODE: 'CATALOG_DUPLICATE_BARCODE',
  CATALOG_NOT_EMPTY: 'CATALOG_NOT_EMPTY',
  INSUFFICIENT_INVENTORY: 'CATALOG_INSUFFICIENT_INVENTORY',
  META_SYNC_DISABLED: 'CATALOG_META_SYNC_DISABLED',
  INVALID_IMPORT_FILE: 'CATALOG_INVALID_IMPORT_FILE',
  CONFIG_MISSING: 'CATALOG_CONFIG_MISSING',
  INVALID_IMAGE: 'CATALOG_INVALID_IMAGE',
  IMAGE_STORAGE_DISABLED: 'CATALOG_IMAGE_STORAGE_DISABLED',
  VISION_DISABLED: 'CATALOG_VISION_DISABLED',
  VISION_MODEL_MISMATCH: 'CATALOG_VISION_MODEL_MISMATCH',
  VISION_DIMENSIONS_MISMATCH: 'CATALOG_VISION_DIMENSIONS_MISMATCH',
  INVALID_WEBHOOK_SIGNATURE: 'CATALOG_INVALID_WEBHOOK_SIGNATURE',
  WEBHOOK_NOT_CONFIGURED: 'CATALOG_WEBHOOK_NOT_CONFIGURED',
} as const

export class ProductNotFoundError extends CatalogError {
  constructor(public readonly productId: string) {
    super('Produto não encontrado.', 404, CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND, { productId })
  }
}

export class CatalogNotFoundError extends CatalogError {
  constructor(public readonly catalogId: string) {
    super('Catálogo não encontrado.', 404, CATALOG_ERROR_CODES.CATALOG_NOT_FOUND, { catalogId })
  }
}

export class SectionNotFoundError extends CatalogError {
  constructor(public readonly sectionId: string) {
    super('Seção não encontrada.', 404, CATALOG_ERROR_CODES.SECTION_NOT_FOUND, { sectionId })
  }
}

/** Código de barras é único por empresa — duas linhas com o mesmo GTIN quebram a busca por leitor. */
export class DuplicateBarcodeError extends CatalogError {
  constructor(public readonly barcode: string) {
    super('Já existe produto com este código de barras.', 409, CATALOG_ERROR_CODES.DUPLICATE_BARCODE, { barcode })
  }
}

/**
 * Excluir catálogo com produto dentro deixaria os itens órfãos e sumidos da UI. 409 e não 400:
 * o pedido é válido, o estado é que impede.
 */
export class CatalogNotEmptyError extends CatalogError {
  constructor(
    public readonly catalogId: string,
    public readonly productCount: number,
  ) {
    super('Catálogo ainda tem produtos.', 409, CATALOG_ERROR_CODES.CATALOG_NOT_EMPTY, { catalogId, productCount })
  }
}

export class InsufficientInventoryError extends CatalogError {
  constructor(
    public readonly productId: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super('Estoque insuficiente.', 409, CATALOG_ERROR_CODES.INSUFFICIENT_INVENTORY, {
      productId,
      available,
      requested,
    })
  }
}

/** Pedido de publicar com `metaSync` desligado — erro de composição do host, não do usuário. */
export class MetaSyncDisabledError extends CatalogError {
  constructor() {
    super('Sincronização com a Meta está desligada para este módulo.', 409, CATALOG_ERROR_CODES.META_SYNC_DISABLED)
  }
}

export class InvalidImportFileError extends CatalogError {
  constructor(public readonly reason: string) {
    super('Arquivo de importação inválido.', 400, CATALOG_ERROR_CODES.INVALID_IMPORT_FILE, { reason })
  }
}

/**
 * Único erro que nomeia o campo na mensagem: é lido por quem sobe o serviço, não devolvido a
 * cliente. Nome do campo, nunca o valor.
 */
export class ConfigMissingError extends CatalogError {
  constructor(public readonly field: string) {
    super(`Configuração obrigatória ausente: ${field}.`, 500, CATALOG_ERROR_CODES.CONFIG_MISSING, { field })
  }
}

export class InvalidProductImageError extends CatalogError {
  constructor(public readonly reason: string) {
    super('Imagem de produto inválida.', 400, CATALOG_ERROR_CODES.INVALID_IMAGE, { reason })
  }
}

/**
 * Só acontece se o host montar a rota sem a porta — a rota nem é publicada quando `imageStorage`
 * está ausente, então isto é rede de proteção para composição errada, não caminho de usuário.
 */
export class ImageStorageDisabledError extends CatalogError {
  constructor() {
    super('Upload de imagem está desligado para este módulo.', 409, CATALOG_ERROR_CODES.IMAGE_STORAGE_DISABLED)
  }
}

/**
 * Assinatura HMAC ausente ou divergente. 401 sem detalhe nenhum: dizer *por que* falhou entrega
 * ao atacante se ele acertou o formato, o prefixo ou o segredo.
 */
export class InvalidCatalogWebhookSignatureError extends CatalogError {
  constructor() {
    super('Assinatura do webhook inválida.', 401, CATALOG_ERROR_CODES.INVALID_WEBHOOK_SIGNATURE)
  }
}

/**
 * A rota de webhook subiu sem segredo configurado. Fail-closed: sem o app secret não há como
 * distinguir a Meta de qualquer um na internet, e um webhook aberto de catálogo aceita comando
 * de mudança de produto.
 */
export class CatalogWebhookNotConfiguredError extends CatalogError {
  constructor(missingField: string) {
    super('Webhook de catálogo não configurado.', 503, CATALOG_ERROR_CODES.WEBHOOK_NOT_CONFIGURED, { missingField })
  }
}

export class VisionDisabledError extends CatalogError {
  constructor() {
    super('Busca de produto por imagem está desligada para este módulo.', 409, CATALOG_ERROR_CODES.VISION_DISABLED)
  }
}

/**
 * O provider mudou de modelo de embedding e o índice guardado é de outro. Vetor de modelos
 * diferentes é comparável em tipo e sem sentido em significado: a busca continuaria respondendo,
 * com produto errado. Falhar no boot é o que transforma isso num erro visível.
 */
export class VisionModelMismatchError extends CatalogError {
  constructor(
    public readonly indexedModel: string,
    public readonly providerModel: string,
  ) {
    super(
      'O modelo de embedding do provider difere do que indexou o catálogo; reindexe antes de usar.',
      409,
      CATALOG_ERROR_CODES.VISION_MODEL_MISMATCH,
      { indexedModel, providerModel },
    )
  }
}

/**
 * O provider gera vetor de tamanho diferente do que a coluna comporta. Falha na composicao, antes
 * da primeira foto: o `INSERT` recusaria de qualquer forma, mas ai o erro apareceria como uma
 * mensagem quebrada no meio de uma conversa, e nao como um host que nao sobe.
 */
export class VisionDimensionsMismatchError extends CatalogError {
  constructor(
    public readonly expected: number,
    public readonly received: number,
  ) {
    super(
      'O provider de visao gera vetor de dimensao incompativel com o indice deste modulo.',
      409,
      CATALOG_ERROR_CODES.VISION_DIMENSIONS_MISMATCH,
      { expected, received },
    )
  }
}
