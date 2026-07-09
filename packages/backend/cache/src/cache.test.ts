import { describe, it, expect } from 'bun:test'
import { Cache } from '../src/index.js'

describe('Cache', () => {
  it('set and get values', () => {
    const cache = new Cache<string>()
    cache.set('a', 'hello')
    expect(cache.get('a')).toBe('hello')
  })

  it('returns undefined for missing keys', () => {
    const cache = new Cache<string>()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('has checks existence', () => {
    const cache = new Cache<string>()
    cache.set('a', 'v')
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('delete removes key', () => {
    const cache = new Cache<string>()
    cache.set('a', 'v')
    expect(cache.delete('a')).toBe(true)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.delete('a')).toBe(false)
  })

  it('TTL expires values', async () => {
    const cache = new Cache<string>({ ttlMs: 100 })
    cache.set('k', 'v')
    expect(cache.get('k')).toBe('v')
    await new Promise((r) => setTimeout(r, 150))
    expect(cache.get('k')).toBeUndefined()
  })

  it('maxSize evicts oldest entry', () => {
    const cache = new Cache<string>({ maxSize: 2 })
    cache.set('1', 'a')
    cache.set('2', 'b')
    cache.set('3', 'c')
    expect(cache.get('1')).toBeUndefined()
    expect(cache.get('2')).toBe('b')
    expect(cache.get('3')).toBe('c')
    expect(cache.size()).toBe(2)
  })

  it('size and keys reflect valid entries', async () => {
    const cache = new Cache<string>({ ttlMs: 50 })
    cache.set('a', '1')
    cache.set('b', '2')
    expect(cache.size()).toBe(2)
    expect(cache.keys()).toEqual(['a', 'b'])
    await new Promise((r) => setTimeout(r, 100))
    expect(cache.size()).toBe(0)
    expect(cache.keys()).toEqual([])
  })

  it('cleanup removes expired entries', async () => {
    const cache = new Cache<string>({ ttlMs: 50 })
    cache.set('a', '1')
    cache.set('b', '2')
    await new Promise((r) => setTimeout(r, 100))
    const removed = cache.cleanup()
    expect(removed).toBe(2)
    expect(cache.size()).toBe(0)
  })

  it('clear removes all', () => {
    const cache = new Cache<string>()
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.size()).toBe(0)
  })

  it('destroy stops cleanup', () => {
    const cache = new Cache<string>()
    cache.set('a', '1')
    cache.destroy()
    expect(cache.size()).toBe(0)
  })
})
