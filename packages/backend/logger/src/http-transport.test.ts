import { describe, it, expect, afterEach } from 'bun:test'
import { HttpTransport } from './http-transport'

interface CapturedRequest {
  body: string
  contentType: string | null
}

interface FakeSink {
  url: string
  requests: CapturedRequest[]
  stop(): void
}

function startFakeSink(): FakeSink {
  const requests: CapturedRequest[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push({
        body: await request.text(),
        contentType: request.headers.get('content-type'),
      })
      return new Response(null, { status: 204 })
    },
  })

  return {
    url: `http://localhost:${server.port}/ingest`,
    requests,
    stop: () => server.stop(true),
  }
}

function startFailingSink(): FakeSink {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response('erro', { status: 500 })
    },
  })

  return {
    url: `http://localhost:${server.port}/ingest`,
    requests: [],
    stop: () => server.stop(true),
  }
}

const activeTransports: HttpTransport[] = []
const activeSinks: FakeSink[] = []

function trackTransport(transport: HttpTransport): HttpTransport {
  activeTransports.push(transport)
  return transport
}

function trackSink(sink: FakeSink): FakeSink {
  activeSinks.push(sink)
  return sink
}

afterEach(() => {
  while (activeTransports.length > 0) activeTransports.pop()?.stop()
  while (activeSinks.length > 0) activeSinks.pop()?.stop()
})

describe('HttpTransport — sinkUrl vazio desliga', () => {
  it('não envia nada e enqueue não lança', () => {
    const transport = trackTransport(new HttpTransport({ sinkUrl: '' }))

    expect(() => transport.enqueue({ message: 'nunca sai' })).not.toThrow()
  })

  it('flush manual é no-op sem sinkUrl', async () => {
    const transport = trackTransport(new HttpTransport({ sinkUrl: undefined }))
    transport.enqueue({ message: 'nunca sai' })

    await expect(transport.flush()).resolves.toBeUndefined()
  })
})

describe('HttpTransport — NDJSON e batching', () => {
  it('envia uma linha por entrada, separada por \\n, como NDJSON', async () => {
    const sink = trackSink(startFakeSink())
    const transport = trackTransport(new HttpTransport({ sinkUrl: sink.url, batchSize: 10 }))

    transport.enqueue({ message: 'primeira' })
    transport.enqueue({ message: 'segunda' })
    await transport.flush()

    expect(sink.requests).toHaveLength(1)
    expect(sink.requests[0]?.contentType).toBe('application/x-ndjson')

    const lines = sink.requests[0]?.body.trim().split('\n') ?? []
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] as string)).toEqual({ message: 'primeira' })
    expect(JSON.parse(lines[1] as string)).toEqual({ message: 'segunda' })
  })

  it('dispara flush sozinho ao atingir o batchSize', async () => {
    const sink = trackSink(startFakeSink())
    const transport = trackTransport(new HttpTransport({ sinkUrl: sink.url, batchSize: 2 }))

    transport.enqueue({ message: 'um' })
    transport.enqueue({ message: 'dois' })

    await Bun.sleep(10)

    expect(sink.requests).toHaveLength(1)
    expect(sink.requests[0]?.body.trim().split('\n')).toHaveLength(2)
  })

  it('manda em lotes de no máximo batchSize por request', async () => {
    const sink = trackSink(startFakeSink())
    const transport = trackTransport(new HttpTransport({ sinkUrl: sink.url, batchSize: 3 }))

    for (let index = 0; index < 7; index += 1) transport.enqueue({ index })
    await transport.flush()
    await transport.flush()
    await transport.flush()

    const sizes = sink.requests.map((request) => request.body.trim().split('\n').length)
    expect(sizes).toEqual([3, 3, 1])
  })
})

describe('HttpTransport — fila com teto', () => {
  it('não cresce além do maxQueueSize, descartando o mais antigo', async () => {
    const sink = trackSink(startFakeSink())
    const transport = trackTransport(new HttpTransport({ sinkUrl: sink.url, batchSize: 100, maxQueueSize: 3 }))

    for (let index = 0; index < 5; index += 1) transport.enqueue({ index })
    await transport.flush()

    const lines = sink.requests[0]?.body.trim().split('\n') ?? []
    const indexes = lines.map((line) => JSON.parse(line).index)
    expect(indexes).toEqual([2, 3, 4])
  })
})

describe('HttpTransport — descarte silencioso', () => {
  it('não lança quando o sink responde erro', async () => {
    const sink = trackSink(startFailingSink())
    const transport = trackTransport(new HttpTransport({ sinkUrl: sink.url }))

    transport.enqueue({ message: 'vai falhar' })

    await expect(transport.flush()).resolves.toBeUndefined()
  })

  it('não lança quando o host não existe, e a fila volta a aceitar entradas depois', async () => {
    const transport = trackTransport(new HttpTransport({ sinkUrl: 'http://127.0.0.1:1/inexistente' }))

    transport.enqueue({ message: 'vai falhar' })
    await expect(transport.flush()).resolves.toBeUndefined()

    expect(() => transport.enqueue({ message: 'depois da falha' })).not.toThrow()
  })
})

describe('HttpTransport — encerramento', () => {
  it('stop() para o timer sem lançar mesmo chamado duas vezes', () => {
    const transport = trackTransport(new HttpTransport({ sinkUrl: 'http://localhost:1' }))

    expect(() => transport.stop()).not.toThrow()
    expect(() => transport.stop()).not.toThrow()
  })
})
