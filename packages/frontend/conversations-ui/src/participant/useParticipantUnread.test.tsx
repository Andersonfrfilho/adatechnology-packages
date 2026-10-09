import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import { buildMessage } from './participantFixtures.test-helper'
import type { ParticipantPerspective } from './participantPerspective'
import { useParticipantUnread } from './useParticipantUnread'

const MESSAGES: readonly ParticipantMessage[] = [
  buildMessage({ id: 'a', direction: 'inbound' }),
  buildMessage({ id: 'b', direction: 'inbound' }),
  buildMessage({ id: 'c', direction: 'outbound' }),
]

type ProbeProps = { readonly perspective?: ParticipantPerspective; readonly reported: number }

function Probe({ perspective, reported }: ProbeProps) {
  const { unreadCount } = useParticipantUnread({ messages: MESSAGES, perspective, reportedUnreadCount: reported })
  return <output>{unreadCount}</output>
}

function unreadOf(props: ProbeProps): string {
  return renderToStaticMarkup(<Probe {...props} />)
}

describe('useParticipantUnread', () => {
  it('keeps the count the inbox reported when no perspective is given', () => {
    expect(unreadOf({ reported: 3 })).toBe('<output>3</output>')
    expect(unreadOf({ reported: 0 })).toBe('<output>0</output>')
  })

  it('derives from the messages for the operator: only the inbound ones, whatever the inbox said', () => {
    expect(unreadOf({ perspective: 'operator', reported: 9 })).toBe('<output>2</output>')
  })

  it('derives from the messages for the participant: only the outbound ones', () => {
    expect(unreadOf({ perspective: 'participant', reported: 9 })).toBe('<output>1</output>')
  })
})
