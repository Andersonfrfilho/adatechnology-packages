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
  NOT_A_TEMPLATE: 'CONTENT_NOT_A_TEMPLATE',
  TEMPLATE_NOT_PUBLISHABLE: 'CONTENT_TEMPLATE_NOT_PUBLISHABLE',
  NOT_PUBLISHED: 'CONTENT_NOT_PUBLISHED',
  REPUBLISH_DATE_IN_FUTURE: 'CONTENT_REPUBLISH_DATE_IN_FUTURE',
  RECURRENCE_NOT_FOUND: 'CONTENT_RECURRENCE_NOT_FOUND',
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

/** Só modelo serve de base para "novo a partir de modelo" e para recorrência. */
export class NotATemplateError extends ContentError {
  constructor(public readonly postId: string) {
    super('Este post não é um modelo.', 422, CONTENT_ERROR_CODES.NOT_A_TEMPLATE, { postId })
  }
}

/** Modelo no ar apareceria no site com texto de exemplo: publicar modelo é sempre recusado. */
export class TemplateNotPublishableError extends ContentError {
  constructor(public readonly postId: string) {
    super(
      'Modelo não pode ser publicado: crie um post a partir dele.',
      422,
      CONTENT_ERROR_CODES.TEMPLATE_NOT_PUBLISHABLE,
      {
        postId,
      },
    )
  }
}

export class PostNotPublishedError extends ContentError {
  constructor(public readonly postId: string) {
    super('Só post publicado pode ser republicado.', 422, CONTENT_ERROR_CODES.NOT_PUBLISHED, { postId })
  }
}

/** Republicar com data futura tiraria o post do ar até lá (404 para leitor e buscador). */
export class RepublishDateInFutureError extends ContentError {
  constructor() {
    super(
      'A nova data não pode ser futura: o post sairia do ar até lá.',
      422,
      CONTENT_ERROR_CODES.REPUBLISH_DATE_IN_FUTURE,
    )
  }
}

export class RecurrenceNotFoundError extends ContentError {
  constructor(public readonly reference: string) {
    super('Recorrência não encontrada.', 404, CONTENT_ERROR_CODES.RECURRENCE_NOT_FOUND, { reference })
  }
}
