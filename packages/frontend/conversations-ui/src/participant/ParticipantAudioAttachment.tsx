import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import { ParticipantAudioPlayer } from './ParticipantAudioPlayer'
import { resolveParticipantAudioLabels } from './participantAudioLabels'
import type { ParticipantConversationsLabels } from './participantLabels'
import { useStableAttachmentUrl } from './useStableAttachmentUrl'

export type ParticipantAudioAttachmentProps = {
  readonly attachment: ParticipantAttachment
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  readonly labels: ParticipantConversationsLabels
}

export function ParticipantAudioAttachment({ attachment, resolveAttachmentUrl, labels }: ParticipantAudioAttachmentProps) {
  const source = useStableAttachmentUrl({ attachment, resolveAttachmentUrl })
  return (
    <div className="cv-p-attachment cv-p-attachment--audio">
      <ParticipantAudioPlayer
        labels={resolveParticipantAudioLabels(labels)}
        url={source.url}
        durationMs={attachment.durationMs}
        filename={attachment.filename}
        isPending={source.status === 'pending'}
        isUnavailable={source.status === 'failed'}
        onSourceError={source.resolveAgain}
      />
      <span className="cv-p-attachment__name">{attachment.filename}</span>
    </div>
  )
}
