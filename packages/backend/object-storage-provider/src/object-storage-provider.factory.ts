/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from './object-storage-provider.error'
import type { ObjectStorageProvider, ObjectStorageProviderConfig } from './object-storage-provider.types'

const NOT_IMPLEMENTED_MESSAGE = 'Object storage capability is not implemented'

function rejectMissingCapability<TResult>(): Promise<TResult> {
  return Promise.reject(new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.notImplemented, NOT_IMPLEMENTED_MESSAGE))
}

export function createObjectStorageProvider(config: ObjectStorageProviderConfig): ObjectStorageProvider {
  void config
  return {
    put: () => rejectMissingCapability(),
    get: () => rejectMissingCapability(),
    head: () => rejectMissingCapability(),
    delete: () => rejectMissingCapability(),
    createSignedDownload: () => rejectMissingCapability(),
    health: () => rejectMissingCapability(),
    close: () => rejectMissingCapability(),
  }
}
