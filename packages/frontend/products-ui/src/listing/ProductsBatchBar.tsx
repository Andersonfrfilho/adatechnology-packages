import { Eye, EyeOff, FolderInput, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import type { Catalog } from '../providers/types'
import type { ProductsListingLabels } from './listing.labels'
import type { ProductsSelectRenderProps } from './listing.types'
import type { ProductsBatchState } from './useProductsBatch'

export type ProductsBatchBarProps = {
  readonly labels: ProductsListingLabels
  readonly selectedIds: readonly string[]
  readonly catalogs: readonly Catalog[]
  readonly batch: ProductsBatchState
  readonly renderSelect: (props: ProductsSelectRenderProps) => React.ReactNode
  readonly onClearSelection: () => void
}

const ACTION_CLASS = 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40'

// Só existe com seleção. A exclusão pede um segundo clique na própria barra: não depende de diálogo do host.
export function ProductsBatchBar({ labels, selectedIds, catalogs, batch, renderSelect, onClearSelection }: ProductsBatchBarProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  if (selectedIds.length === 0) return null

  async function handleUpdate(data: { active: boolean } | { catalogId: string }): Promise<void> {
    await batch.update(selectedIds, data)
    onClearSelection()
  }

  async function handleConfirmDelete(): Promise<void> {
    setIsConfirmingDelete(false)
    await batch.remove(selectedIds)
    onClearSelection()
  }

  return (
    <div role="region" aria-label={labels.batchRegion} className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
      <span role="status" className="text-sm font-medium text-brand-800">{labels.selectedCount(selectedIds.length)}</span>
      {isConfirmingDelete ? (
        <>
          <span className="text-sm text-gray-800">{labels.batchDeleteConfirm(selectedIds.length)}</span>
          <button type="button" disabled={batch.isRunning} onClick={() => void handleConfirmDelete()} className={`${ACTION_CLASS} border-red-300 text-red-700`}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {labels.batchConfirm}
          </button>
          <button type="button" onClick={() => setIsConfirmingDelete(false)} className={ACTION_CLASS}>{labels.batchCancel}</button>
        </>
      ) : (
        <>
          <button type="button" disabled={batch.isRunning} onClick={() => void handleUpdate({ active: true })} className={ACTION_CLASS}>
            <Eye aria-hidden="true" className="h-4 w-4" />
            {labels.batchActivate}
          </button>
          <button type="button" disabled={batch.isRunning} onClick={() => void handleUpdate({ active: false })} className={ACTION_CLASS}>
            <EyeOff aria-hidden="true" className="h-4 w-4" />
            {labels.batchDeactivate}
          </button>
          {catalogs.length > 0 ? (
            <span className="inline-flex items-center gap-2">
              <FolderInput aria-hidden="true" className="h-4 w-4 text-gray-600" />
              {renderSelect({
                id: 'products-batch-move',
                label: labels.batchMove,
                value: '',
                options: [{ id: '', label: labels.batchMove }, ...catalogs.map((catalog) => ({ id: catalog.id, label: catalog.name }))],
                onChange: (catalogId) => { if (catalogId) void handleUpdate({ catalogId }) },
              })}
            </span>
          ) : null}
          <button type="button" disabled={batch.isRunning} onClick={() => setIsConfirmingDelete(true)} className={`${ACTION_CLASS} text-red-700`}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {labels.batchDelete}
          </button>
        </>
      )}
      <button type="button" onClick={onClearSelection} className={`${ACTION_CLASS} ml-auto`}>
        <X aria-hidden="true" className="h-4 w-4" />
        {labels.batchClear}
      </button>
      {batch.failedCount > 0 ? <p role="alert" className="w-full text-sm text-red-700">{labels.batchPartialFailure(batch.failedCount)}</p> : null}
    </div>
  )
}
