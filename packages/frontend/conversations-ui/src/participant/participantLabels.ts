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
  readonly retry: string
  readonly discard: string
  readonly edit: string
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
}

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
}

export function formatParticipantLabel(template: string, count: number): string {
  return template.replace('{count}', String(count))
}
