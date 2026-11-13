export interface CacheOptions {
  ttlMs?: number
  maxSize?: number
}

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}
