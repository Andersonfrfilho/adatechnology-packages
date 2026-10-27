import { DEFAULT_PARTICIPANT_AUDIO_LABELS, type ParticipantAudioLabels } from './participantAudioLabels'

export const DEFAULT_MESSAGE_OPTIONS_LABEL = 'Message options'
export const DEFAULT_SHOW_ORIGINAL_TEXT_LABEL = 'Show original'

export type ParticipantConversationsLabels = {
  readonly inboxTitle: string
  readonly sectionAwaiting: string
  readonly sectionClosed: string
  readonly sectionOther: string
  readonly filterAll: string
  readonly filtersGroup: string
  readonly emptyInbox: string
  /** Uses the `{count}` placeholder. */
  readonly unreadCount: string
  readonly back: string
  readonly openSubject: string
  readonly me: string
  readonly newMessages: string
  readonly loadOlder: string
  /** Accessible name of the floating button that returns to the end of the conversation. */
  readonly scrollToLatest: string
  readonly closedNotice: string
  readonly messageInputLabel: string
  readonly messageInputPlaceholder: string
  readonly send: string
  readonly attach: string
  readonly attachmentsList: string
  readonly removeAttachment: string
  readonly attachmentTooLarge: string
  readonly attachmentTypeNotAccepted: string
  readonly quickRepliesGroup: string
  readonly downloadAttachment: string
  readonly statusSending: string
  readonly statusQueued: string
  readonly statusSent: string
  readonly statusDelivered: string
  readonly statusRead: string
  readonly statusFailed: string
  readonly statusFailedShort: string
  /** @deprecated No longer rendered by the default view: the retry button is icon-only and named by `statusFailed`. */
  readonly retry: string
  readonly discard: string
  readonly edit: string
  /** Name of the menu button on a failed message. Optional; translated hosts should fill it, otherwise the English default shows. */
  readonly messageOptions?: string
  /** Message menu (opt-in `messageMenu`). Optional; translated hosts should fill them, otherwise English shows. */
  readonly copyMessage?: string
  readonly copySelection?: string
  readonly selectMessages?: string
  /** Name of the check box beside each message in selection mode. */
  readonly selectMessage?: string
  readonly cancelSelection?: string
  /** Selection bar count; `{count}` is replaced. */
  readonly selectedCount?: string
  /** Message info panel: when it was sent, its delivery state and when it was read. */
  readonly messageInfo?: string
  readonly infoAuthor?: string
  readonly infoSentAt?: string
  readonly infoStatus?: string
  readonly infoReadAt?: string
  readonly closeMessageInfo?: string
  /** Header menu of a thread with `messageMenu`: select messages and download the conversation as text. */
  readonly conversationOptions?: string
  readonly downloadConversation?: string
  /** Transcribed audio: the word before what was said in copies and exports, and its two menu entries. */
  readonly transcriptionPrefix?: string
  readonly copyTranscription?: string
  readonly downloadTranscription?: string
  /** Toggle that opens the message as received (e.g. the whole email). Optional; the English default shows otherwise. */
  readonly showOriginalText?: string
  readonly notFound: string
  readonly loading: string
  readonly loadError: string
  readonly loadMore: string
  readonly searchLabel: string
  readonly searchPlaceholder: string
  readonly noResults: string
  readonly noResultsInFilter: string
  readonly noResultsLoadedOnly: string
  /** Spoken before the protocol code, e.g. "Protocol 261009-K7M2". */
  readonly protocolPrefix: string
  readonly copyProtocol: string
  readonly protocolCopied: string
  readonly channelsGroup: string
  readonly channelApp: string
  readonly channelWhatsapp: string
  readonly channelEmail: string
  readonly channelPortal: string
  readonly channelWebchat: string
  /** Spoken after a link that opens in a new tab. */
  readonly externalLinkHint: string
  /** Prefix of the accessible name of the copy buttons: "Copy 529.982.247-25". */
  readonly copyValue: string
  readonly valueCopied: string
} & Readonly<Partial<ParticipantAudioLabels>>

export const DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS: ParticipantConversationsLabels = {
  inboxTitle: 'Conversations',
  sectionAwaiting: 'Waiting for your reply',
  sectionClosed: 'Closed',
  sectionOther: 'Other',
  filterAll: 'All',
  filtersGroup: 'Filter by subject',
  emptyInbox: 'No conversations yet',
  unreadCount: '{count} unread',
  back: 'Back',
  openSubject: 'Open subject',
  me: 'Me',
  newMessages: 'New messages',
  loadOlder: 'Load older messages',
  scrollToLatest: 'Scroll to latest message',
  closedNotice: 'This conversation is closed',
  messageInputLabel: 'Message',
  messageInputPlaceholder: 'Write a message…',
  send: 'Send',
  attach: 'Attach',
  attachmentsList: 'Selected attachments',
  removeAttachment: 'Remove attachment',
  attachmentTooLarge: 'Attachment too large',
  attachmentTypeNotAccepted: 'File type not accepted',
  quickRepliesGroup: 'Quick replies',
  downloadAttachment: 'Download',
  statusSending: 'Sending',
  statusQueued: 'Queued — sends when back online',
  statusSent: 'Sent',
  statusDelivered: 'Delivered',
  statusRead: 'Read',
  statusFailed: 'Failed — tap to retry',
  statusFailedShort: 'Failed',
  retry: 'Retry',
  discard: 'Discard',
  edit: 'Edit',
  messageOptions: DEFAULT_MESSAGE_OPTIONS_LABEL,
  showOriginalText: DEFAULT_SHOW_ORIGINAL_TEXT_LABEL,
  copyMessage: 'Copy',
  copySelection: 'Copy selection',
  selectMessages: 'Select messages',
  selectMessage: 'Select message',
  cancelSelection: 'Cancel selection',
  selectedCount: '{count} selected',
  messageInfo: 'Message info',
  infoAuthor: 'From',
  infoSentAt: 'Sent',
  infoStatus: 'Status',
  infoReadAt: 'Read',
  closeMessageInfo: 'Close',
  conversationOptions: 'Conversation options',
  downloadConversation: 'Download conversation',
  transcriptionPrefix: 'Transcription',
  copyTranscription: 'Copy transcription',
  downloadTranscription: 'Download transcription',
  notFound: 'Conversation not found',
  loading: 'Loading…',
  loadError: 'Could not load. Check your connection and try again.',
  loadMore: 'Load more',
  searchLabel: 'Search conversations',
  searchPlaceholder: 'Search by title or protocol',
  noResults: 'No conversations found',
  noResultsInFilter: 'No results in this filter — try All',
  noResultsLoadedOnly: 'Nothing in the loaded conversations — load more',
  protocolPrefix: 'Protocol',
  copyProtocol: 'Copy protocol',
  protocolCopied: 'Protocol copied',
  channelsGroup: 'Channels in this conversation',
  channelApp: 'App',
  channelWhatsapp: 'WhatsApp',
  channelEmail: 'Email',
  channelPortal: 'Portal',
  channelWebchat: 'Web chat',
  externalLinkHint: 'opens in a new tab',
  copyValue: 'Copy',
  valueCopied: 'Copied',
  ...DEFAULT_PARTICIPANT_AUDIO_LABELS,
}

export function formatParticipantLabel(template: string, count: number): string {
  return template.replace('{count}', String(count))
}
