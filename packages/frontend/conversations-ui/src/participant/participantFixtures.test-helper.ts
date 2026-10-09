import type { ParticipantConversationSummary, ParticipantMessage } from '@adatechnology/conversation-contracts'

export function buildConversation(
  overrides: Partial<ParticipantConversationSummary> & { subjectId: string },
): ParticipantConversationSummary {
  return {
    subjectType: 'invoice',
    subjectLabel: 'Invoice 4521',
    lastMessageAt: '2026-10-01T10:00:00.000Z',
    unreadCount: 0,
    awaitingParticipant: false,
    status: 'open',
    ...overrides,
  }
}

export function buildMessage(overrides: Partial<ParticipantMessage> & { id: string }): ParticipantMessage {
  return {
    direction: 'outbound',
    text: 'Hello',
    attachments: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

const UTILITY_PREFIXES = /^(flex|grid|block|inline|hidden|p[xytblr]?-|m[xytblr]?-|text-|bg-|border|rounded|w-|h-|min-|max-|items-|justify-|gap-|space-|font-|shadow|dark:|hover:|sm:|md:)/

/** Returns the class tokens in the markup that look like Tailwind utilities. */
export function findUtilityClassTokens(markup: string): string[] {
  const classAttributes = [...markup.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? '')
  const tokens = classAttributes.flatMap((value) => value.split(/\s+/).filter(Boolean))
  return tokens.filter((token) => UTILITY_PREFIXES.test(token))
}

/** Returns class tokens that do not belong to the participant namespace or the reused leaf components. */
export function findForeignClassTokens(markup: string): string[] {
  const classAttributes = [...markup.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? '')
  const tokens = classAttributes.flatMap((value) => value.split(/\s+/).filter(Boolean))
  return tokens.filter((token) => !/^(cv-p$|cv-p-|cv-status-ticks|cv-message-text|lucide)/.test(token))
}
