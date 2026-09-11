/**
 * Seção de anexos do formulário de cadastro (QR-31), extraída de `QuickRepliesWorkspace`: lista de
 * anexos já subidos (com reordenação), uploads em voo e recusas de arquivo. Some inteira quando o
 * host não oferece `uploadQuickReplyAttachment` — a mesma regra de capacidade do resto do pacote.
 */

import { useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { formatFileSize } from '../lib/format'
import type { PendingAttachmentUpload } from './useQuickReplyAttachmentUploads'
import type { AttachmentFileRejection } from './quickReplyAttachmentUpload'
import type { QuickReplyAttachment } from './quickReply.types'
import type { QuickRepliesWorkspaceLabels } from './labels'

export type AttachmentsFormSectionProps = {
  readonly labels: QuickRepliesWorkspaceLabels
  readonly attachments: readonly QuickReplyAttachment[]
  readonly pendingUploads: readonly PendingAttachmentUpload[]
  readonly attachmentRejections: readonly AttachmentFileRejection[]
  readonly onAddFiles: (files: FileList) => void
  readonly onRetryUpload: (localId: string) => void
  readonly onCancelUpload: (localId: string) => void
  readonly onRemoveAttachment: (uploadId: string) => void
  readonly onMoveAttachment: (index: number, direction: -1 | 1) => void
  readonly onDismissRejections: () => void
}

export function AttachmentsFormSection({
  labels: text,
  attachments,
  pendingUploads,
  attachmentRejections,
  onAddFiles,
  onRetryUpload,
  onCancelUpload,
  onRemoveAttachment,
  onMoveAttachment,
  onDismissRejections,
}: AttachmentsFormSectionProps) {
  const attachmentFileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{text.attachmentsTitle}</span>

      {attachments.length === 0 && pendingUploads.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{text.attachmentsEmpty}</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((attachment, index) => (
            <li
              key={attachment.uploadId}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700"
            >
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5 flex-none text-gray-400" />
              <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
              <span className="flex-none text-gray-400">{formatFileSize(attachment.sizeBytes)}</span>
              <button
                type="button"
                disabled={index === 0}
                aria-label={text.attachmentMoveUp}
                onClick={() => onMoveAttachment(index, -1)}
                className="flex-none disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === attachments.length - 1}
                aria-label={text.attachmentMoveDown}
                onClick={() => onMoveAttachment(index, 1)}
                className="flex-none disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={text.attachmentRemove}
                onClick={() => onRemoveAttachment(attachment.uploadId)}
                className="flex-none text-red-600 dark:text-red-400"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {pendingUploads.map((pending) => (
            <li
              key={pending.localId}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700"
              aria-busy={pending.status === 'uploading'}
              aria-live="polite"
            >
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5 flex-none text-gray-400" />
              <span className="min-w-0 flex-1 truncate">{pending.file.name}</span>
              {pending.status === 'uploading' ? (
                <span className="flex-none text-gray-500 dark:text-gray-400">
                  {text.attachmentUploading(Math.round(pending.progress * 100))}
                </span>
              ) : (
                <>
                  <span role="alert" className="flex-none text-red-600 dark:text-red-400">
                    {pending.error}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRetryUpload(pending.localId)}
                    className="flex-none font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {text.attachmentRetry}
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label={text.attachmentCancel}
                onClick={() => onCancelUpload(pending.localId)}
                className="flex-none text-gray-400"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachmentRejections.length > 0 ? (
        <div role="alert" className="space-y-0.5 text-xs text-red-600 dark:text-red-400">
          {attachmentRejections.map((rejection, index) => (
            <p key={index}>
              {rejection.reason === 'limit'
                ? text.attachmentLimitReached
                : text.attachmentTooLarge(rejection.file.name)}
            </p>
          ))}
          <button type="button" onClick={onDismissRejections} className="hover:underline">
            {text.cancel}
          </button>
        </div>
      ) : null}

      <input
        ref={attachmentFileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) onAddFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => attachmentFileInputRef.current?.click()}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {text.attachmentsAdd}
      </button>
    </div>
  )
}
