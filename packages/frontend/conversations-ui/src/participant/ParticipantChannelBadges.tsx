import { Globe, Mail, MessageCircle, MessagesSquare, Smartphone } from 'lucide-react'
import type { ComponentType } from 'react'

import {
  resolveParticipantChannelLabel,
  resolveParticipantChannels,
  type ParticipantChannelDescriptor,
} from './participantChannels'
import type { ParticipantConversationsLabels } from './participantLabels'

const ICONS: Record<
  ParticipantChannelDescriptor['iconName'],
  ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
> = {
  Smartphone,
  MessageCircle,
  Mail,
  Globe,
  MessagesSquare,
}

export type ParticipantChannelBadgesProps = {
  readonly channels: readonly string[] | undefined
  readonly labels: ParticipantConversationsLabels
}

export function ParticipantChannelBadges({ channels, labels }: ParticipantChannelBadgesProps) {
  const descriptors = resolveParticipantChannels(channels)
  if (descriptors.length === 0) return null

  return (
    <ul className="cv-p-channels" aria-label={labels.channelsGroup}>
      {descriptors.map((descriptor) => {
        const Icon = ICONS[descriptor.iconName]
        return (
          <li key={descriptor.channel} className={`cv-p-channel cv-p-channel--${descriptor.channel}`}>
            <Icon size={14} aria-hidden={true} />
            <span className="cv-p-sr-only">{resolveParticipantChannelLabel(descriptor, labels)}</span>
          </li>
        )
      })}
    </ul>
  )
}
