import { useEffect, useState } from 'react'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { formatFileSize } from '../lib/format'
import { ParticipantAudioAttachment } from './ParticipantAudioAttachment'
import { isSafeAttachmentUrl } from './participantAttachmentUrl'
import type { ParticipantConversationsLabels } from './participantLabels'

export type ResolveParticipantAttachmentUrl = (
  attachment: ParticipantAttachment,
  disposition?: 'inline' | 'attachment',
) => Promise<string>

export type ParticipantAttachmentItemProps = {
  readonly attachment: ParticipantAttachment
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  readonly labels: ParticipantConversationsLabels
}

function useAttachmentUrl(
  attachment: ParticipantAttachment,
  resolveAttachmentUrl: ResolveParticipantAttachmentUrl,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const disposition = attachment.kind === 'document' ? 'attachment' : 'inline'

  useEffect(() => {
    let isCurrent = true
    resolveAttachmentUrl(attachment, disposition).then(
      (resolved) => {
        if (isCurrent) setUrl(isSafeAttachmentUrl(resolved) ? resolved.trim() : undefined)
      },
      () => {
        if (isCurrent) setUrl(undefined)
      },
    )
    return () => {
      isCurrent = false
    }
  }, [attachment, disposition, resolveAttachmentUrl])

  return url
}

export function ParticipantAttachmentItem(props: ParticipantAttachmentItemProps) {
  if (props.attachment.kind === 'audio') return <ParticipantAudioAttachment {...props} />
  return <ParticipantFileAttachment {...props} />
}

function ParticipantFileAttachment({ attachment, resolveAttachmentUrl, labels }: ParticipantAttachmentItemProps) {
  const url = useAttachmentUrl(attachment, resolveAttachmentUrl)

  if (attachment.kind === 'image') {
    return (
      <figure className="cv-p-attachment cv-p-attachment--image">
        {url ? <img className="cv-p-attachment__image" src={url} alt={attachment.filename} /> : null}
        <figcaption className="cv-p-attachment__name">{attachment.filename}</figcaption>
      </figure>
    )
  }

  return (
    <a
      className="cv-p-attachment cv-p-attachment--document"
      href={url}
      download={attachment.filename}
      aria-label={`${labels.downloadAttachment}: ${attachment.filename}`}
    >
      <span className="cv-p-attachment__name">{attachment.filename}</span>
      <span className="cv-p-attachment__size">{formatFileSize(attachment.sizeBytes)}</span>
    </a>
  )
}
