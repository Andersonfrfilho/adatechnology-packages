import { User } from 'lucide-react'
import type { ReactNode } from 'react'

import { authorInitials } from './participantAvatar'

export type ParticipantAuthorAvatarRenderer = (author: { name: string | null }) => ReactNode

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
