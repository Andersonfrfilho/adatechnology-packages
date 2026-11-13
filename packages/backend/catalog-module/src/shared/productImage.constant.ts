/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * O teto é o mesmo do componente de upload do painel, de propósito: o cliente recusa cedo para não
 * gastar a rede do usuário, e o servidor recusa de novo porque o cliente não é fonte de verdade.
 */
export const PRODUCT_IMAGE = {
  MAX_BYTES: 5 * 1024 * 1024,
  KEY_PREFIX: 'products',
  EXTENSION_BY_MIME: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  } as Readonly<Record<string, string | undefined>>,
} as const
