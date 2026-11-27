import { useCallback, useState } from 'react'

import { useProducts } from '../providers/ProductsProvider'
import type { ProductsBatchResult, UpdateProductInput } from '../providers/types'

export type ProductsBatchState = {
  readonly isRunning: boolean
  /** Quantos itens a última ação não conseguiu alterar; 0 = tudo certo. */
  readonly failedCount: number
  readonly update: (ids: readonly string[], data: UpdateProductInput) => Promise<void>
  readonly remove: (ids: readonly string[]) => Promise<void>
}

function fromSettled(results: readonly PromiseSettledResult<unknown>[]): ProductsBatchResult {
  const succeeded = results.filter((result) => result.status === 'fulfilled').length
  return { succeeded, failed: results.length - succeeded }
}

// Usa a ação em lote do host quando ela existe; senão repete a ação unitária, sem parar no primeiro erro.
export function useProductsBatch(onDone: () => void): ProductsBatchState {
  const api = useProducts()
  const [isRunning, setIsRunning] = useState(false)
  const [failedCount, setFailedCount] = useState(0)

  const run = useCallback(
    async (action: () => Promise<ProductsBatchResult>) => {
      setIsRunning(true)
      try {
        const result = await action().catch(() => undefined)
        setFailedCount(result?.failed ?? 1)
      } finally {
        setIsRunning(false)
        onDone()
      }
    },
    [onDone],
  )

  const update = useCallback(
    (ids: readonly string[], data: UpdateProductInput) =>
      run(async () =>
        api.updateProducts
          ? api.updateProducts(ids, data)
          : fromSettled(await Promise.allSettled(ids.map((id) => api.updateProduct(id, data)))),
      ),
    [api, run],
  )

  const remove = useCallback(
    (ids: readonly string[]) =>
      run(async () =>
        api.deleteProducts
          ? api.deleteProducts(ids)
          : fromSettled(await Promise.allSettled(ids.map((id) => api.deleteProduct(id)))),
      ),
    [api, run],
  )

  return { isRunning, failedCount, update, remove }
}
