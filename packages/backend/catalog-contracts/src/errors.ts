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
