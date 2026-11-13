/**
 * Cache dos grafos de fluxo.
 *
 * O grafo é lido a cada mensagem recebida — é o caminho mais quente do bot, e sem cache cada
 * "oi" de cliente vira uma leitura completa no banco. O que este arquivo trava não é a
 * aceleração (essa é fácil de ver), e sim as três formas de ela machucar o cliente: servir grafo
 * velho depois de publicar, vazar grafo entre empresas, e derrubar a conversa quando o Redis cai.
 */

import { describe, expect, it, mock } from 'bun:test'
import type { CacheInterface, FlowGraphData } from '@adatechnology/meta-whatsapp-contracts'
import { FlowGraphCache } from './FlowGraphCache'

const GRAFO: FlowGraphData = {
  key: 'consorcio',
  label: 'Consórcio',
  startNodeId: 'consorcioPara',
  version: 3,
  nodes: {
    consorcioPara: { id: 'consorcioPara', type: 'question', question: 'Para quê?' },
  },
}

function cacheProviderStub(overrides: Partial<CacheInterface> = {}): CacheInterface {
  return {
    get: mock<CacheInterface['get']>(async () => null),
    set: mock<CacheInterface['set']>(async () => undefined),
    delete: mock<CacheInterface['delete']>(async () => undefined),
    ...overrides,
  }
}

describe('FlowGraphCache', () => {
  it('devolve o grafo gravado', async () => {
    const armazenado = new Map<string, string>()
    const provider = cacheProviderStub({
      get: async (key) => armazenado.get(key) ?? null,
      set: async (key, value) => void armazenado.set(key, value),
    })
    const cache = new FlowGraphCache(provider, 300)

    await cache.write('empresa-1', GRAFO)

    expect(await cache.read('empresa-1', 'consorcio')).toEqual(GRAFO)
  })

  it('não devolve grafo de outra empresa', async () => {
    const armazenado = new Map<string, string>()
    const provider = cacheProviderStub({
      get: async (key) => armazenado.get(key) ?? null,
      set: async (key, value) => void armazenado.set(key, value),
    })
    const cache = new FlowGraphCache(provider, 300)

    await cache.write('empresa-1', GRAFO)

    expect(await cache.read('empresa-2', 'consorcio')).toBeUndefined()
  })

  it('apaga a entrada ao invalidar', async () => {
    const armazenado = new Map<string, string>()
    const provider = cacheProviderStub({
      get: async (key) => armazenado.get(key) ?? null,
      set: async (key, value) => void armazenado.set(key, value),
      delete: async (key) => void armazenado.delete(key),
    })
    const cache = new FlowGraphCache(provider, 300)

    await cache.write('empresa-1', GRAFO)
    await cache.invalidate('empresa-1', 'consorcio')

    expect(await cache.read('empresa-1', 'consorcio')).toBeUndefined()
  })

  it('grava com o TTL configurado', async () => {
    const set = mock<CacheInterface['set']>(async () => undefined)
    const cache = new FlowGraphCache(cacheProviderStub({ set }), 42)

    await cache.write('empresa-1', GRAFO)

    expect(set.mock.calls[0]![2]).toBe(42)
  })

  // As três abaixo são a regra "cache é aceleração, não dependência". Redis fora do ar tem que
  // degradar para leitura no banco — nunca virar erro na conversa do cliente.
  it('trata leitura que falha como ausência', async () => {
    const provider = cacheProviderStub({
      get: async () => {
        throw new Error('conexão recusada')
      },
    })
    const cache = new FlowGraphCache(provider, 300)

    expect(await cache.read('empresa-1', 'consorcio')).toBeUndefined()
  })

  it('não propaga falha de escrita', async () => {
    const provider = cacheProviderStub({
      set: async () => {
        throw new Error('conexão recusada')
      },
    })
    const cache = new FlowGraphCache(provider, 300)

    expect(cache.write('empresa-1', GRAFO)).resolves.toBeUndefined()
  })

  it('não propaga falha de invalidação', async () => {
    const provider = cacheProviderStub({
      delete: async () => {
        throw new Error('conexão recusada')
      },
    })
    const cache = new FlowGraphCache(provider, 300)

    expect(cache.invalidate('empresa-1', 'consorcio')).resolves.toBeUndefined()
  })

  // Conteúdo corrompido na chave (deploy antigo, alguém editando o Redis na mão) não pode
  // estourar no meio da conversa: vale o mesmo que estar ausente, e o banco resolve.
  it('trata conteúdo inválido como ausência', async () => {
    const provider = cacheProviderStub({ get: async () => 'isto não é json' })
    const cache = new FlowGraphCache(provider, 300)

    expect(await cache.read('empresa-1', 'consorcio')).toBeUndefined()
  })
})
