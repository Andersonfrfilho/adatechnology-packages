import { HttpClient, HttpError } from '../src/index.js'

const client = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com', timeoutMs: 10_000, retries: 1 })

async function main() {
  console.log('GET /posts/1')
  const post = await client.get<{ id: number; title: string }>('/posts/1')
  console.log('  Status:', post.status, 'Title:', post.data.title)

  console.log('\nPOST /posts')
  const created = await client.post<{ id: number }>('/posts', { title: 'test', body: 'bar', userId: 1 })
  console.log('  Status:', created.status, 'ID:', created.data.id)

  console.log('\nGET /nonexistent (expect 404)')
  try {
    await client.get('/nonexistent')
  } catch (err) {
    if (err instanceof HttpError) {
      console.log('  Caught HttpError:', err.status, err.message)
    }
  }

  console.log('\nRetry test — unreachable URL')
  const badClient = new HttpClient({ baseUrl: 'http://localhost:19999', retries: 2, retryDelayMs: 300 })
  try {
    await badClient.get('/')
  } catch (err) {
    console.log('  Failed after retries:', err instanceof Error ? err.message : err)
  }

  console.log('\nHTTP client demo complete')
}

main().catch(console.error)
