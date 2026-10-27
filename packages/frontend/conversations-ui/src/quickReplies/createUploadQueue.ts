/**
 * Fila de upload compartilhada (M1): no máximo `maxConcurrent` itens em voo ao mesmo tempo,
 * qualquer que seja a sequência de chamadas que os enfileirou (anexar novo arquivo, repetir um
 * que falhou). Sem isto, `addAttachmentFiles` e `retryAttachmentUpload` cada um abria sua própria
 * janela de concorrência, e a soma das duas podia passar de 3 uploads simultâneos.
 */

export type UploadQueueRunner = (signal: AbortSignal) => Promise<void>

export type UploadQueueHandle = {
  /** Enfileira `id`; começa a rodar assim que houver vaga. Reenfileirar um `id` já pendente ou
   * ativo substitui o worker anterior por este. */
  readonly enqueue: (id: string, run: UploadQueueRunner) => void
  /** Aborta `id`: se estiver ativo, aborta o `AbortSignal` dele; se só estiver pendente, remove
   * da fila sem nunca chegar a rodar. */
  readonly abort: (id: string) => void
  /** Aborta tudo — ativo e pendente — e esvazia a fila. */
  readonly abortAll: () => void
}

export function createUploadQueue(maxConcurrent: number): UploadQueueHandle {
  const pending: string[] = []
  const runners = new Map<string, UploadQueueRunner>()
  const controllers = new Map<string, AbortController>()
  let activeCount = 0

  function pump(): void {
    while (activeCount < maxConcurrent && pending.length > 0) {
      const id = pending.shift() as string
      const run = runners.get(id)
      runners.delete(id)
      if (!run) continue
      const controller = new AbortController()
      controllers.set(id, controller)
      activeCount += 1
      void run(controller.signal).finally(() => {
        controllers.delete(id)
        activeCount -= 1
        pump()
      })
    }
  }

  function enqueue(id: string, run: UploadQueueRunner): void {
    if (controllers.has(id)) return
    runners.set(id, run)
    if (!pending.includes(id)) pending.push(id)
    pump()
  }

  function abort(id: string): void {
    const controller = controllers.get(id)
    if (controller) {
      controller.abort()
      return
    }
    const index = pending.indexOf(id)
    if (index >= 0) pending.splice(index, 1)
    runners.delete(id)
  }

  function abortAll(): void {
    for (const controller of controllers.values()) controller.abort()
    pending.length = 0
    runners.clear()
  }

  return { enqueue, abort, abortAll }
}
