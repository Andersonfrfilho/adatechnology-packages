/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * 1 MiB é o teto de corpo do `module-http`: um limite maior aqui seria promessa que a rota não
 * cumpre. O `content-ui` avisa antes de enviar; o servidor recusa de novo porque o cliente não é
 * fonte de verdade.
 */
export const COVER_IMAGE = {
  MAX_BYTES: 1024 * 1024,
  KEY_PREFIX: 'content/posts',
  EXTENSION_BY_MIME: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  } as Readonly<Record<string, string | undefined>>,
} as const
