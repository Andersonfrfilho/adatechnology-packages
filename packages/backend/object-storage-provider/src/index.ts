/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from './object-storage-provider.error'
export type { ObjectStorageErrorCode } from './object-storage-provider.error'
export { createObjectStorageProvider } from './object-storage-provider.factory'
export type {
  DeleteObjectInput,
  GetObjectInput,
  HeadObjectInput,
  ObjectBody,
  ObjectLocation,
  ObjectStorageProvider,
  ObjectStorageProviderConfig,
  ObjectStorageProviderHealth,
  PutObjectInput,
  PutObjectResult,
  SignedDownloadInput,
  StoredObject,
} from './object-storage-provider.types'
