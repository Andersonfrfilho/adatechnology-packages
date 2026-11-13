/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Upload da imagem do produto. O bucket é do host (porta `ProductImageStoragePort`); aqui ficam as
 * decisões que não podem variar por instalação: o que é imagem aceitável, o teto de tamanho e a
 * forma da chave.
 */

import { ImageStorageDisabledError, InvalidProductImageError } from '@adatechnology/catalog-contracts'

import { PRODUCT_IMAGE } from '../shared/productImage.constant'
import type { CatalogDependencies } from './catalogModule.types'

export type UploadProductImageParams = {
  readonly companyId: string
  readonly bytes: Uint8Array
  readonly mimeType: string
}

export type UploadProductImageResult = {
  readonly url: string
  readonly key: string
}

export class UploadProductImageUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: UploadProductImageParams): Promise<UploadProductImageResult> {
    const storage = this.dependencies.imageStorage
    if (!storage) throw new ImageStorageDisabledError()

    const mimeType = normalizeMimeType(params.mimeType)
    const extension = PRODUCT_IMAGE.EXTENSION_BY_MIME[mimeType]
    // Lista fechada, e não "começa com image/": SVG é imagem e carrega script, e a Meta recusa
    // formato que não esteja nesta lista de qualquer forma.
    if (!extension) throw new InvalidProductImageError('unsupported_type')

    if (params.bytes.byteLength === 0) throw new InvalidProductImageError('empty')
    if (params.bytes.byteLength > PRODUCT_IMAGE.MAX_BYTES) throw new InvalidProductImageError('too_large')

    // A chave nunca carrega nome de arquivo nem nada digitado: nome de arquivo é entrada de
    // usuário, vai para uma URL pública e já chegou a vazar dado pessoal em outros produtos.
    const key = `${PRODUCT_IMAGE.KEY_PREFIX}/${params.companyId}/${crypto.randomUUID()}.${extension}`

    return storage.upload({ buffer: Buffer.from(params.bytes), mimeType, key })
  }
}

/** `image/jpeg; charset=binary` e maiúsculas chegam de cliente real; o mime é só a primeira parte. */
function normalizeMimeType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase()
}
