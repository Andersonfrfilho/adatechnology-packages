/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Upload da capa. O bucket é do host (`ContentImageStoragePort`); aqui ficam as decisões que não
 * variam por instalação: formatos aceitos, teto de tamanho e forma da chave.
 */

import { ImageStorageDisabledError, InvalidCoverImageError } from '@adatechnology/content-contracts'

import { COVER_IMAGE } from '../shared/coverImage.constant'
import type { ContentDependencies } from './contentModule.types'

export type UploadCoverImageParams = {
  readonly companyId: string
  readonly bytes: Uint8Array
  readonly mimeType: string
}

export type UploadCoverImageResult = { readonly url: string; readonly key: string }

export class UploadCoverImageUseCase {
  constructor(private readonly dependencies: ContentDependencies) {}

  async execute(params: UploadCoverImageParams): Promise<UploadCoverImageResult> {
    const storage = this.dependencies.imageStorage
    if (!storage) throw new ImageStorageDisabledError()

    const mimeType = (params.mimeType.split(';')[0] ?? '').trim().toLowerCase()
    // Lista fechada, não "começa com image/": SVG é imagem e carrega script.
    const extension = COVER_IMAGE.EXTENSION_BY_MIME[mimeType]
    if (!extension) throw new InvalidCoverImageError('unsupported_type')
    if (params.bytes.byteLength === 0) throw new InvalidCoverImageError('empty')
    if (params.bytes.byteLength > COVER_IMAGE.MAX_BYTES) throw new InvalidCoverImageError('too_large')

    // A chave nunca carrega nome de arquivo: é entrada de usuário e vai parar numa URL pública.
    const key = `${COVER_IMAGE.KEY_PREFIX}/${params.companyId}/${crypto.randomUUID()}.${extension}`
    return storage.upload({ buffer: params.bytes, mimeType, key })
  }
}
