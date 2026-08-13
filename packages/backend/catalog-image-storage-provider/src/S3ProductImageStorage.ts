/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Liga a porta de imagem do `catalog-module` a um bucket S3-compatível.
 *
 * O módulo guarda a porta e não a implementação de propósito — quem só gerencia catálogo interno
 * não deve baixar o SDK da AWS por tabela. Este pacote é a ponte, e existe para as decisões abaixo
 * não serem redecididas em cada produto.
 */

import type { ProductImageStoragePort } from '@adatechnology/catalog-contracts'
import type { ObjectStorageProvider } from '@adatechnology/object-storage-provider'

export type S3ProductImageStorageParams = {
  readonly storage: ObjectStorageProvider
  readonly bucket: string
  /**
   * Base pública da URL devolvida, separada do endpoint de propósito.
   *
   * Quem busca a imagem do produto é a Meta, para renderizar o item dentro do WhatsApp: a URL
   * precisa ser estável e sem credencial. URL assinada expira, e o catálogo aparece quebrado
   * semanas depois — sem nada falhar no momento em que quebrou.
   */
  readonly publicBaseUrl: string
}

export function createS3ProductImageStorage(params: S3ProductImageStorageParams): ProductImageStoragePort {
  const publicBaseUrl = params.publicBaseUrl.replace(/\/+$/, '')

  return {
    async upload(input) {
      const stored = await params.storage.put({
        bucket: params.bucket,
        key: input.key,
        body: new Uint8Array(input.buffer),
        contentLength: input.buffer.byteLength,
        contentType: input.mimeType,
        sha256: await sha256Hex(input.buffer),
        // A chave já é um UUID novo a cada envio: colisão aqui é bug, e sobrescrever a esconderia.
        mode: 'create-only',
      })

      return { url: `${publicBaseUrl}/${stored.key}`, key: stored.key }
    },

    async delete(key) {
      await params.storage.delete({ bucket: params.bucket, key })
    },
  }
}

/** `crypto.subtle` em vez de `node:crypto`: o pacote roda em Bun, Node e Workers sem import de runtime. */
async function sha256Hex(buffer: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
