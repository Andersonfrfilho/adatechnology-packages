/**
 * Funções puras do upload de anexo na tela de cadastro (QR-31): validação antes de subir,
 * reordenação e o limitador de concorrência. Sem estado de React — testáveis sem montar o hook.
 */

import { canAddAttachments, resolveMaxAttachmentSizeBytes } from './quickReplyAttachments'
import type { MaxAttachmentSizeBytes } from './quickReplyAttachments'

export type AttachmentFileRejection = { readonly file: File; readonly reason: 'limit' | 'size' }

export type ValidateAttachmentFilesResult = {
  readonly accepted: readonly File[]
  readonly rejected: readonly AttachmentFileRejection[]
}

/**
 * Valida o teto de 10 e o tamanho por tipo ANTES de subir (QR-31) — nunca gasta um upload inteiro
 * num arquivo que já ia ser recusado. Processa em ordem: um arquivo que estoura o teto no meio do
 * lote não impede os anteriores de entrar, só ele e os que vêm depois.
 */
export function validateAttachmentFiles(
  files: readonly File[],
  currentCount: number,
  limits?: MaxAttachmentSizeBytes,
): ValidateAttachmentFilesResult {
  const accepted: File[] = []
  const rejected: AttachmentFileRejection[] = []
  let count = currentCount
  for (const file of files) {
    if (!canAddAttachments(count, 1)) {
      rejected.push({ file, reason: 'limit' })
      continue
    }
    const maxSize = resolveMaxAttachmentSizeBytes(file.type, limits)
    if (file.size > maxSize) {
      rejected.push({ file, reason: 'size' })
      continue
    }
    accepted.push(file)
    count += 1
  }
  return { accepted, rejected }
}

/** Move um item uma posição — usado pelos botões de reordenar (acessíveis por teclado). Fora da
 * faixa, devolve a mesma lista em vez de estourar. */
export function moveAttachment<T>(list: readonly T[], index: number, direction: -1 | 1): readonly T[] {
  const target = index + direction
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item as T)
  return next
}

/**
 * Roda `worker` sobre `items` com no máximo `limit` em paralelo (QR-31: até 3 uploads ao mesmo
 * tempo). O resultado preserva a ordem de `items` — a posição *i* é sempre o resultado do item *i*,
 * mesmo que o item *i+1* termine primeiro.
 */
export async function mapWithConcurrencyLimit<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    const index = nextIndex
    nextIndex += 1
    if (index >= items.length) return
    const item = items[index] as TItem
    results[index] = await worker(item, index)
    await runNext()
  }

  const workerCount = Math.max(0, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => runNext()))
  return results
}
