import { formatTimestamp } from '../lib/format'
import { ParticipantAttachmentItem, type ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import { OwnStatus } from './ParticipantBubbleStatus'
import { ParticipantFailedMenu } from './ParticipantFailedMenu'
import type { BubbleContent } from './ParticipantMessageBubble'
import { ParticipantMessageText } from './ParticipantMessageText'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantOwnMessageStatus } from './participantMessages'

type BubbleBodyProps = {
  readonly content: BubbleContent
  readonly labels: ParticipantConversationsLabels
  readonly ownStatus?: ParticipantOwnMessageStatus
  readonly textId?: string
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  readonly onRetry?: () => void
  readonly onDiscard?: () => void
  readonly onEdit?: () => void
}

function BubbleHeading({ content, labels }: Pick<BubbleBodyProps, 'content' | 'labels'>) {
  if (content.isMine) return <span className="cv-p-sr-only">{labels.me}</span>
  if (!content.authorName) return null
  return <span className="cv-p-bubble__author">{content.authorName}</span>
}

export function BubbleBody({ content, labels, ownStatus, textId, resolveAttachmentUrl, onRetry, onDiscard, onEdit }: BubbleBodyProps) {
  return (
    <>
      <BubbleHeading content={content} labels={labels} />
      {content.text ? <ParticipantMessageText text={content.text} labels={labels} id={textId} /> : null}
      {content.attachments.map((attachment) => (
        <ParticipantAttachmentItem
          key={attachment.id}
          attachment={attachment}
          resolveAttachmentUrl={resolveAttachmentUrl}
          labels={labels}
        />
      ))}
      {content.pendingFilenames.map((filename, index) => (
        <span key={`${filename}-${index}`} className="cv-p-attachment cv-p-attachment--pending">
          {filename}
        </span>
      ))}
      <span className="cv-p-bubble__meta">
        <time className="cv-p-bubble__time" dateTime={content.createdAt}>
          {formatTimestamp(content.createdAt)}
        </time>
        {ownStatus ? <OwnStatus status={ownStatus} labels={labels} onRetry={onRetry} /> : null}
        {ownStatus === 'failed' ? <ParticipantFailedMenu labels={labels} onEdit={onEdit} onDiscard={onDiscard} /> : null}
      </span>
    </>
  )
}
