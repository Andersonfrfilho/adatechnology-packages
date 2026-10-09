import type { ReactNode } from 'react'

export type ParticipantConversationAvatarProps = {
  readonly icon: ReactNode
}

export function ParticipantConversationAvatar({ icon }: ParticipantConversationAvatarProps) {
  return (
    <span className="cv-p-thread__avatar" aria-hidden="true">
      {icon}
    </span>
  )
}
