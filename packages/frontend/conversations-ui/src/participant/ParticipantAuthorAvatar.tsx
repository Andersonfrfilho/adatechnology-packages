import { User } from 'lucide-react'
import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'
import type { ReactNode } from 'react'

import { authorInitials } from './participantAvatar'

export type ParticipantAuthorAvatarRenderer = (author: { name: string | null }) => ReactNode

/** What the host receives to draw per-message actions (copy, forward...); only messages the server already holds. */
export type ParticipantMessageActionsTarget = {
  readonly id: string
  readonly text: string | null
  readonly authorName: string | null
  readonly isMine: boolean
  readonly attachments: readonly ParticipantAttachment[]
}

export type ParticipantMessageActionsRenderer = (message: ParticipantMessageActionsTarget) => ReactNode

export type ParticipantAuthorAvatarProps = {
  readonly name: string | null
  /** Host slot (a photo, for instance); its result wins over the initials. */
  readonly render?: ParticipantAuthorAvatarRenderer
}

export function ParticipantAuthorAvatar({ name, render }: ParticipantAuthorAvatarProps) {
  const fromHost = render?.({ name })
  const hasHostContent = !(fromHost == null || fromHost === false || fromHost === '')
  const initials = authorInitials(name)
  const fallback = initials ?? <User size={16} aria-hidden={true} />
  return (
    <span className="cv-p-avatar" aria-hidden="true">
      {hasHostContent ? fromHost : fallback}
    </span>
  )
}
