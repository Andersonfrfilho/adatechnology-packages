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
  /** 'list' draws ul/li; 'inline' draws spans only, valid inside a button. */
  readonly variant?: 'list' | 'inline'
  /** Icon size in pixels. */
  readonly iconSize?: number
}

type BadgeProps = {
  readonly descriptor: ParticipantChannelDescriptor
  readonly labels: ParticipantConversationsLabels
  readonly separator: string
  readonly iconSize: number
}

function BadgeContent({ descriptor, labels, separator, iconSize }: BadgeProps) {
  const Icon = ICONS[descriptor.iconName]
  return (
    <>
      <Icon size={iconSize} aria-hidden={true} />
      <span className="cv-p-sr-only">{`${resolveParticipantChannelLabel(descriptor, labels)}${separator}`}</span>
    </>
  )
}

export function ParticipantChannelBadges({
  channels,
  labels,
  variant = 'list',
  iconSize = 14,
}: ParticipantChannelBadgesProps) {
  const descriptors = resolveParticipantChannels(channels)
  if (descriptors.length === 0) return null

  if (variant === 'inline') {
    return (
      <span className="cv-p-channels">
        <span className="cv-p-sr-only">{`${labels.channelsGroup}: `}</span>
        {descriptors.map((descriptor, index) => (
          <span key={descriptor.channel} className={`cv-p-channel cv-p-channel--${descriptor.channel}`}>
            <BadgeContent
              descriptor={descriptor}
              labels={labels}
              separator={index < descriptors.length - 1 ? ', ' : ''}
              iconSize={iconSize}
            />
          </span>
        ))}
      </span>
    )
  }

  return (
    <ul className="cv-p-channels" aria-label={labels.channelsGroup}>
      {descriptors.map((descriptor) => (
        <li key={descriptor.channel} className={`cv-p-channel cv-p-channel--${descriptor.channel}`}>
          <BadgeContent descriptor={descriptor} labels={labels} separator="" iconSize={iconSize} />
        </li>
      ))}
    </ul>
  )
}
