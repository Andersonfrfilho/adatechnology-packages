/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida: pacote publicado não importa o `DomainError` do host. Mesmo molde de
 * `catalog-contracts/src/errors.ts` — o `module-http` reconhece pela forma (`statusCode`, `code`).
 */

export class ContentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ContentError'
  }
}

export const CONTENT_ERROR_CODES = {
  POST_NOT_FOUND: 'CONTENT_POST_NOT_FOUND',
  DUPLICATE_SLUG: 'CONTENT_DUPLICATE_SLUG',
  INVALID_SLUG: 'CONTENT_INVALID_SLUG',
  CONFIG_MISSING: 'CONTENT_CONFIG_MISSING',
  INVALID_IMAGE: 'CONTENT_INVALID_IMAGE',
  IMAGE_STORAGE_DISABLED: 'CONTENT_IMAGE_STORAGE_DISABLED',
} as const
export type ContentErrorCode = (typeof CONTENT_ERROR_CODES)[keyof typeof CONTENT_ERROR_CODES]

/** 404 também para post de outra empresa: confirmar a existência já seria vazamento. */
export class PostNotFoundError extends ContentError {
  constructor(public readonly reference: string) {
    super('Post não encontrado.', 404, CONTENT_ERROR_CODES.POST_NOT_FOUND, { reference })
  }
}

/** O slug é a URL pública; dois posts com o mesmo slug na mesma empresa tornariam um inalcançável. */
export class DuplicateSlugError extends ContentError {
  constructor(public readonly slug: string) {
    super('Já existe post com este endereço (slug).', 409, CONTENT_ERROR_CODES.DUPLICATE_SLUG, { slug })
  }
}

export class InvalidSlugError extends ContentError {
  constructor(public readonly slug: string) {
    super('Endereço (slug) inválido.', 400, CONTENT_ERROR_CODES.INVALID_SLUG, { slug })
  }
}

export class ConfigMissingError extends ContentError {
  constructor(public readonly field: string) {
    super(`Configuração ausente ou inválida: ${field}.`, 500, CONTENT_ERROR_CODES.CONFIG_MISSING, { field })
  }
}

export type InvalidImageReason = 'unsupported_type' | 'empty' | 'too_large'

export class InvalidCoverImageError extends ContentError {
  constructor(public readonly reason: InvalidImageReason) {
    super('Imagem de capa inválida.', 400, CONTENT_ERROR_CODES.INVALID_IMAGE, { reason })
  }
}

/** Sem porta de storage a rota de upload nem sobe; isto só dispara se o use-case for chamado direto. */
export class ImageStorageDisabledError extends ContentError {
  constructor() {
    super('Envio de imagem não configurado.', 501, CONTENT_ERROR_CODES.IMAGE_STORAGE_DISABLED)
  }
}
