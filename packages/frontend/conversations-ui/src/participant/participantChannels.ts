import type { ConversationChannel } from '@adatechnology/conversation-contracts'

import type { ParticipantConversationsLabels } from './participantLabels'

export type ParticipantChannelDescriptor = {
  readonly channel: ConversationChannel
  readonly iconName: 'Smartphone' | 'MessageCircle' | 'Mail' | 'Globe' | 'MessagesSquare'
  readonly labelKey: 'channelApp' | 'channelWhatsapp' | 'channelEmail' | 'channelPortal' | 'channelWebchat'
}

export const PARTICIPANT_CHANNEL_ORDER: readonly ParticipantChannelDescriptor[] = [
  { channel: 'app', iconName: 'Smartphone', labelKey: 'channelApp' },
  { channel: 'whatsapp', iconName: 'MessageCircle', labelKey: 'channelWhatsapp' },
  { channel: 'email', iconName: 'Mail', labelKey: 'channelEmail' },
  { channel: 'portal', iconName: 'Globe', labelKey: 'channelPortal' },
  { channel: 'webchat', iconName: 'MessagesSquare', labelKey: 'channelWebchat' },
]

/** Stable badge order regardless of the server order; duplicates and unknown values (runtime) are dropped. */
export function resolveParticipantChannels(
  channels: readonly string[] | undefined,
): readonly ParticipantChannelDescriptor[] {
  if (channels === undefined || channels.length === 0) return []
  const present = new Set<string>(channels)
  return PARTICIPANT_CHANNEL_ORDER.filter((descriptor) => present.has(descriptor.channel))
}

export function resolveParticipantChannelLabel(
  descriptor: ParticipantChannelDescriptor,
  labels: ParticipantConversationsLabels,
): string {
  return labels[descriptor.labelKey]
}
