/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Archive, CircleCheck, EyeOff, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type { PostListTab } from '../hooks/usePostList'
import { useContentAdminApi, useContentText } from '../providers/ContentProvider'
import { ActionDialog } from './ActionDialog'

export type BatchBarProps = {
  readonly ids: readonly string[]
  readonly tab: PostListTab | undefined
  readonly onClearSelection: () => void
  readonly onDone: () => void
}

type BatchAction = 'publish' | 'unpublish' | 'archive'

/** Ações em lote sobre as linhas marcadas. Cada post vai por conta própria: falhar um não desfaz os outros. */
export function BatchBar({ ids, tab, onClearSelection, onDone }: BatchBarProps): ReactNode {
  const api = useContentAdminApi()
  const { messages, format } = useContentText()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [result, setResult] = useState<string | undefined>()

  async function run(action: BatchAction): Promise<void> {
    setIsBusy(true)
    const calls = ids.map((id) =>
      action === 'publish' ? api.publishPost(id) : action === 'unpublish' ? api.unpublishPost(id) : api.archivePost(id),
    )
    const settled = await Promise.allSettled(calls)
    const done = settled.filter((entry) => entry.status === 'fulfilled').length
    setResult(done === ids.length ? undefined : format('batchPartial', { done, total: ids.length }))
    setIsBusy(false)
    setIsConfirming(false)
    onDone()
  }

  const canPublish = tab === 'draft'
  const canUnpublish = tab === 'published' || tab === 'scheduled'
  return (
    <div className="adc-batch-bar" role="region" aria-label={messages.batchLabel}>
      <strong>{format('selectedCount', { count: ids.length })}</strong>
      {canPublish && (
        <button
          type="button"
          className="adc-button adc-button--compact"
          disabled={isBusy}
          onClick={() => void run('publish')}
        >
          <CircleCheck aria-hidden="true" className="adc-icon" />
          {messages.batchPublish}
        </button>
      )}
      {canUnpublish && (
        <button
          type="button"
          className="adc-button adc-button--compact"
          disabled={isBusy}
          onClick={() => void run('unpublish')}
        >
          <EyeOff aria-hidden="true" className="adc-icon" />
          {messages.batchUnpublish}
        </button>
      )}
      <button
        type="button"
        className="adc-button adc-button--compact adc-button--danger"
        disabled={isBusy}
        onClick={() => setIsConfirming(true)}
      >
        <Archive aria-hidden="true" className="adc-icon" />
        {messages.batchArchive}
      </button>
      <button type="button" className="adc-button adc-button--compact adc-button--ghost" onClick={onClearSelection}>
        <X aria-hidden="true" className="adc-icon" />
        {messages.clearSelection}
      </button>
      {result && (
        <span className="adc-error" role="alert">
          {result}
        </span>
      )}
      {isConfirming && (
        <ActionDialog
          title={messages.batchArchive}
          confirmLabel={messages.batchArchive}
          confirmIcon={<Archive aria-hidden="true" className="adc-icon" />}
          isBusy={isBusy}
          onClose={() => setIsConfirming(false)}
          onConfirm={() => void run('archive')}
        >
          <p>{format('batchArchiveConfirm', { count: ids.length })}</p>
        </ActionDialog>
      )}
    </div>
  )
}
