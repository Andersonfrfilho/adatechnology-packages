import type { CacheOptions, CacheEntry } from './types'

export class Cache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()
  private ttlMs: number
  private maxSize: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(opts: CacheOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 60_000
    this.maxSize = opts.maxSize ?? Infinity
    this.timer = setInterval(() => this.cleanup(), 60_000)
    if (this.timer && 'unref' in this.timer) (this.timer as NodeJS.Timeout).unref()
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const first = this.store.keys().next().value
      if (first !== undefined) this.store.delete(first)
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    })
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }
    return true
  }

  clear(): void {
    this.store.clear()
  }

  keys(): string[] {
    return Array.from(this.store.entries())
      .filter(([, e]) => Date.now() <= e.expiresAt)
      .map(([k]) => k)
  }

  size(): number {
    return this.keys().length
  }

  cleanup(): number {
    let count = 0
    for (const [key, entry] of this.store) {
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key)
        count++
      }
    }
    return count
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.store.clear()
  }
}
