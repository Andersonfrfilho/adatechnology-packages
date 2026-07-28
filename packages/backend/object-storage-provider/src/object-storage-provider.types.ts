/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export type ObjectStorageProviderConfig = {
  readonly endpoint: URL
  readonly region: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly forcePathStyle: boolean
  readonly healthCheckBucket: string
  readonly maxObjectSizeBytes: number
}

export type ObjectBody = Uint8Array | ReadableStream<Uint8Array>

export type ObjectLocation = {
  readonly bucket: string
  readonly key: string
}

export type PutObjectInput = ObjectLocation & {
  readonly body: ObjectBody
  readonly contentLength: number
  readonly contentType: string
  readonly sha256: string
  readonly mode: 'create-only'
}

export type StoredObject = ObjectLocation & {
  readonly provider: 's3'
  readonly contentLength: number
  readonly contentType: string
  readonly sha256: string
}

export type PutObjectResult = StoredObject & {
  readonly disposition: 'created' | 'replayed'
}

export type GetObjectInput = ObjectLocation
export type HeadObjectInput = ObjectLocation
export type DeleteObjectInput = ObjectLocation

export type SignedDownloadInput = ObjectLocation & {
  readonly expiresInSeconds: number
  /**
   * `inline` abre no navegador, `attachment` salva. Ausente deixa o navegador decidir pelo
   * content-type.
   *
   * Entra na assinatura da URL, então precisa ser decidido aqui: depois de assinada não há como o
   * cliente trocar.
   */
  readonly disposition?: 'inline' | 'attachment'
  /** Nome sugerido no download. Só faz efeito junto de `disposition`. */
  readonly filename?: string
}

export type ObjectStorageProviderHealth = {
  readonly status: 'up' | 'down'
}

export type ObjectStorageProvider = {
  put(input: PutObjectInput): Promise<PutObjectResult>
  get(input: GetObjectInput): Promise<ReadableStream<Uint8Array>>
  head(input: HeadObjectInput): Promise<StoredObject | undefined>
  delete(input: DeleteObjectInput): Promise<void>
  createSignedDownload(input: SignedDownloadInput): Promise<URL>
  health(): Promise<ObjectStorageProviderHealth>
  close(): Promise<void>
}
