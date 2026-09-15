/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Paperclip } from 'lucide-react'

import { parseWhatsAppFormatting } from '../lib/whatsapp-formatting'
import { WhatsAppMessagePreview } from '../lib/WhatsAppMessagePreview'
import type { ResolvedQuickRepliesWorkspaceLabels } from './labels'
import type { ConversationVariable, QuickReplyAttachment } from './quickReply.types'

export interface QuickReplyWhatsAppPreviewProps {
  readonly body: string
  readonly variables?: readonly ConversationVariable[]
  readonly attachments?: readonly QuickReplyAttachment[]
  readonly labels: Pick<ResolvedQuickRepliesWorkspaceLabels, 'previewTitle' | 'previewEmptyBody'>
}

/** Troca cada marcador pelo exemplo da variável (ou o rótulo, sem exemplo); sem catálogo, fica o marcador. */
export function resolvePreviewVariables(body: string, variables: readonly ConversationVariable[] = []): string {
  return variables.reduce(
    (resolved, variable) =>
      variable.marker ? resolved.split(variable.marker).join(variable.value || variable.label) : resolved,
    body,
  )
}

export function QuickReplyWhatsAppPreview({ body, variables, attachments, labels }: QuickReplyWhatsAppPreviewProps) {
  const resolvedBody = resolvePreviewVariables(body, variables)
  const hasAttachments = (attachments?.length ?? 0) > 0

  return (
    <section aria-label={labels.previewTitle} className="space-y-1">
      <h3 className="text-sm font-medium">{labels.previewTitle}</h3>
      <WhatsAppMessagePreview>
        {hasAttachments ? (
          <ul className="mb-1.5 flex flex-wrap gap-1 whitespace-normal">
            {attachments?.map((attachment) => (
              <li
                key={attachment.uploadId}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10"
              >
                <Paperclip size={12} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{attachment.filename}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {resolvedBody ? (
          parseWhatsAppFormatting(resolvedBody)
        ) : (
          <span className="italic text-gray-400">{labels.previewEmptyBody}</span>
        )}
      </WhatsAppMessagePreview>
    </section>
  )
}
