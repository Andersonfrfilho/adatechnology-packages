import { describe, it, expect } from 'bun:test'
import { HttpClient, HttpError } from '../src/index.js'

describe('HttpClient', () => {
  it('GET request returns data', async () => {
    const client = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com' })
    const res = await client.get<{ id: number }>('/posts/1')
    expect(res.status).toBe(200)
    expect(res.data.id).toBe(1)
  })

  it('POST request returns created resource', async () => {
    const client = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com' })
    const res = await client.post<{ id: number }>('/posts', { title: 'test', body: 'bar', userId: 1 })
    expect(res.status).toBe(201)
    expect(typeof res.data.id).toBe('number')
  })

  it('throws HttpError on 404', async () => {
    const client = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com' })
    let err: HttpError | null = null
    try {
      await client.get('/nonexistent')
    } catch (e) {
      err = e as HttpError
    }
    expect(err).toBeDefined()
    expect(err!.status).toBe(404)
    expect(err!.message).toContain('404')
  })

  it('retries on network errors', async () => {
    const client = new HttpClient({
      baseUrl: 'http://localhost:19999',
      retries: 2,
      retryDelayMs: 100,
      timeoutMs: 1000,
    })
    let err: Error | null = null
    try {
      await client.get('/')
    } catch (e) {
      err = e as Error
    }
    expect(err).toBeDefined()
  })

  it('absolute URLs bypass baseUrl', async () => {
    const client = new HttpClient({ baseUrl: 'http://ignored' })
    const res = await client.get<{ id: number }>('https://jsonplaceholder.typicode.com/posts/1')
    expect(res.status).toBe(200)
  })
})
