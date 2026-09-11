import { describe, expect, it } from 'bun:test'

import { createUploadQueue } from './createUploadQueue'

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('createUploadQueue', () => {
  it('nunca roda mais que o limite ao mesmo tempo, para 10 itens', async () => {
    const queue = createUploadQueue(3)
    let active = 0
    let maxActive = 0
    const gates = Array.from({ length: 10 }, () => deferred())

    for (let index = 0; index < 10; index += 1) {
      queue.enqueue(`item-${index}`, async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await gates[index]?.promise
        active -= 1
      })
    }

    expect(active).toBe(3)
    for (const gate of gates) gate.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(active).toBe(0)
  })

  it('um retry enfileirado com a fila cheia espera vaga', async () => {
    const queue = createUploadQueue(3)
    const gates = Array.from({ length: 3 }, () => deferred())
    for (let index = 0; index < 3; index += 1) {
      queue.enqueue(`initial-${index}`, async () => {
        await gates[index]?.promise
      })
    }

    let retryStarted = false
    queue.enqueue('retry-item', async () => {
      retryStarted = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(retryStarted).toBe(false)

    gates[0]?.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(retryStarted).toBe(true)
  })

  it('abortar um item ainda pendente remove da fila sem rodar', async () => {
    const queue = createUploadQueue(1)
    const blocking = deferred()
    queue.enqueue('blocking', async () => {
      await blocking.promise
    })

    let queuedRan = false
    queue.enqueue('queued', async () => {
      queuedRan = true
    })
    queue.abort('queued')

    blocking.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(queuedRan).toBe(false)
  })

  it('abortar um item ativo libera a vaga para o próximo', async () => {
    const queue = createUploadQueue(1)
    let activeAborted = false
    queue.enqueue('active', async (signal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          activeAborted = true
          resolve()
        })
      })
    })

    let nextRan = false
    queue.enqueue('next', async () => {
      nextRan = true
    })

    queue.abort('active')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(activeAborted).toBe(true)
    expect(nextRan).toBe(true)
  })
})
